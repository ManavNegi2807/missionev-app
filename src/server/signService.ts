import { keccak256, recoverMessageAddress, toHex, type Hex } from "viem";
import { calculateJourney, JourneyInputError } from "@/lib/carbon/emissionsEngine";
import { transportModeName } from "@/lib/carbon/contractMapping";
import type { CarbonResult, JourneyMode, VehicleEnergySpec } from "@/lib/carbon/types";
import { haversineKm } from "@/lib/trip/geo";
import type { CheckResult, GpsSample, RideHailInfo, SignedTrip, TripVehicle } from "@/lib/trip/types";
import { assignTrust, checkMotion, checkRoute, checkVehicle, type VerifyContext } from "@/lib/trip/verification";
import { oracleAddressOf, signTripPayload } from "@/lib/oracle/sign";
import { deriveTripId } from "@/lib/oracle/typedData";
import { PROOF_MAX_AGE_MS, oracleRequestMessage } from "@/lib/oracle/walletProof";
import type { ChainReader } from "./chainReader";
import type { ServerConfig } from "./config";

/**
 * The oracle's decision procedure. It NEVER signs a value the client sent: it re-runs the checks on the evidence,
 * recomputes the distance from the location samples, recalculates the emissions with the shared carbon engine, applies the
 * reward policy, then signs only the figures it derived itself. Everything the contract trusts the oracle for happens here.
 *
 * Known limits (documented, not hidden): the commuter's saved vehicle is self-declared (there is no server-side D1 to
 * check it against), GPS can be spoofed by a device that controls its own location, and the rate-limit and
 * duplicate memory below live in process memory, so a serverless restart forgets them. The contract's own
 * `processedTrips` and nonce still stop on-chain replays.
 */

export interface SignRequest {
  commuter: Hex;
  proof: { message: string; signature: Hex };
  trip: {
    clientTripId: string;
    mode: JourneyMode;
    source: "gps" | "simulated";
    startedAt: number;
    endedAt: number;
    distanceKm: number;
    durationSec: number;
    /** [lat, lng, t(ms), speedKmh] */
    samples: Array<[number, number, number, number]>;
    vehicle: TripVehicle | null;
    rideHail: RideHailInfo | null;
    occupants: number;
  };
}

export type SignOutcome =
  | { status: "signed"; httpStatus: 200; signed: SignedTrip; carbon: CarbonResult; distanceKmUsed: number; checks: Array<{ id: string; status: string; summary: string }> }
  | { status: "invalid" | "unauthorized" | "refused" | "duplicate" | "rate-limited" | "unavailable"; httpStatus: number; reason: string; carbon?: CarbonResult; checks?: Array<{ id: string; status: string; summary: string }> };

export interface SignStore {
  countToday(commuter: string, day: string): number;
  record(commuter: string, day: string, tripId: string): void;
}

export const createMemoryStore = (): SignStore => {
  const m = new Map<string, Set<string>>();
  return {
    countToday: (c, d) => m.get(`${c.toLowerCase()}|${d}`)?.size ?? 0,
    record: (c, d, t) => {
      const k = `${c.toLowerCase()}|${d}`;
      m.set(k, (m.get(k) ?? new Set()).add(t));
    },
  };
};

export interface SignDeps {
  config: ServerConfig;
  reader: ChainReader;
  store: SignStore;
  now?: () => number;
}

const MODES: readonly JourneyMode[] = ["private_ev_car", "private_ev_2w", "private_petrol_car", "private_diesel_car", "private_ice_2w", "ride_hail", "metro", "ebus", "active"];
const isHex = (s: unknown, len: number): s is Hex => typeof s === "string" && new RegExp(`^0x[0-9a-fA-F]{${len}}$`).test(s);
const fin = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const MAX_SAMPLES = 20000;

/** Hand-rolled validation: a request body is untrusted input and is checked field by field. */
export function parseSignRequest(body: unknown): { ok: true; req: SignRequest } | { ok: false; reason: string } {
  const b = body as Partial<SignRequest> | null;
  if (!b || typeof b !== "object") return { ok: false, reason: "The request body must be a JSON object." };
  if (!isHex(b.commuter, 40)) return { ok: false, reason: "commuter must be a 20-byte address." };
  if (!b.proof || typeof b.proof.message !== "string" || b.proof.message.length > 1000 || !/^0x[0-9a-fA-F]{130}$/.test(String(b.proof.signature))) return { ok: false, reason: "A wallet proof (message + signature) is required." };
  const t = b.trip;
  if (!t || typeof t !== "object") return { ok: false, reason: "trip is required." };
  if (typeof t.clientTripId !== "string" || !/^[\w-]{4,64}$/.test(t.clientTripId)) return { ok: false, reason: "clientTripId is malformed." };
  if (!MODES.includes(t.mode)) return { ok: false, reason: "Unknown journey mode." };
  if (t.source !== "gps" && t.source !== "simulated") return { ok: false, reason: "source must be gps or simulated." };
  if (![t.startedAt, t.endedAt, t.distanceKm, t.durationSec].every(fin) || t.endedAt < t.startedAt) return { ok: false, reason: "Trip times and distance must be finite numbers." };
  if (!Array.isArray(t.samples) || t.samples.length < 2 || t.samples.length > MAX_SAMPLES) return { ok: false, reason: `samples must hold 2–${MAX_SAMPLES} entries.` };
  if (!t.samples.every((s) => Array.isArray(s) && s.length === 4 && s.every(fin) && Math.abs(s[0]) <= 90 && Math.abs(s[1]) <= 180)) return { ok: false, reason: "samples must be [lat, lng, t, speed] numbers." };
  if (!(Number.isInteger(t.occupants) && t.occupants >= 1 && t.occupants <= 8)) return { ok: false, reason: "occupants must be 1–8." };
  if (t.vehicle !== null && (typeof t.vehicle !== "object" || !t.vehicle?.spec || typeof t.vehicle.label !== "string")) return { ok: false, reason: "vehicle is malformed." };
  return { ok: true, req: b as SignRequest };
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Path length from raw samples, ignoring sub-3 m GPS jitter like the in-browser tracker does. */
function pathKm(samples: GpsSample[]): number {
  let km = 0;
  for (let i = 1; i < samples.length; i++) {
    const d = haversineKm(samples[i - 1], samples[i]);
    if (d * 1000 >= 3 && (samples[i].t - samples[i - 1].t) / 1000 > 0 && (d / ((samples[i].t - samples[i - 1].t) / 1000)) * 3600 <= 250) km += d;
  }
  return km;
}

export async function evaluateAndSign(req: SignRequest, deps: SignDeps): Promise<SignOutcome> {
  const { config, reader, store } = deps;
  const nowMs = (deps.now ?? Date.now)();
  const t = req.trip;

  if (!config.oracleKey || !config.contract || !config.rpcUrl) {
    return { status: "unavailable", httpStatus: 503, reason: `The oracle isn't configured on this server (missing: ${[!config.contract && "MISSIONEV_CONTRACT_ADDRESS", !config.rpcUrl && "PORTAL_RPC_URL", !config.oracleKey && "ORACLE_PRIVATE_KEY"].filter(Boolean).join(", ")}). Nothing was signed.` };
  }

  /* 1 — who is asking: the holder of the commuter address, for this trip, recently */
  const issued = Number(/Issued at \(ms\): (\d+)/.exec(req.proof.message)?.[1]);
  const expected = oracleRequestMessage({ commuter: req.commuter, clientTripId: t.clientTripId, contract: config.contract, chainId: config.chainId, issuedAt: issued });
  if (!Number.isFinite(issued) || req.proof.message !== expected) return { status: "unauthorized", httpStatus: 401, reason: "The wallet proof doesn't match this commuter, trip, contract and chain." };
  if (nowMs - issued > PROOF_MAX_AGE_MS || issued - nowMs > 60_000) return { status: "unauthorized", httpStatus: 401, reason: "The wallet proof has expired. Sign the request again." };
  const signer = await recoverMessageAddress({ message: req.proof.message, signature: req.proof.signature }).catch(() => null);
  if (!signer || signer.toLowerCase() !== req.commuter.toLowerCase()) return { status: "unauthorized", httpStatus: 401, reason: "The wallet proof wasn't signed by the commuter address." };

  /* 2 — demo data never goes on-chain */
  if (t.source === "simulated") return { status: "refused", httpStatus: 422, reason: "Simulated trips are demo data and are never signed." };

  /* 3 — re-run verification on the evidence */
  const samples: GpsSample[] = t.samples.map(([lat, lng, tt, speedKmh]) => ({ lat, lng, t: tt, speedKmh }));
  const serverKm = pathKm(samples);
  if (serverKm <= 0 || Math.abs(serverKm - t.distanceKm) / serverKm > 0.1) {
    return { status: "refused", httpStatus: 422, reason: `The reported distance (${t.distanceKm.toFixed(2)} km) doesn't match the location samples (${serverKm.toFixed(2)} km).` };
  }
  const distanceKm = Math.min(t.distanceKm, serverKm); // the lower figure is the safe one to sign
  const ctx: VerifyContext = { tripId: t.clientTripId, source: "gps", scenario: "clean", mode: t.mode, route: null, samples, distanceKm, durationSec: t.durationSec, vehicle: t.vehicle, rideHail: t.rideHail, knownFingerprints: [] };
  // 3.2 is the mock EV-maker log: a browser-demo adapter that proves nothing, so the server doesn't count it.
  const noLog: CheckResult = { id: "3.2", status: "na", isDemo: false, summary: "Not used by the oracle: the EV-maker log is a demo adapter.", items: [], technical: {}, at: null };
  const results = { "3.1": checkVehicle(ctx), "3.2": noLog, "3.3": checkMotion(ctx), "3.4": checkRoute(ctx) };
  const trust = assignTrust(results);
  const checks = Object.values(results).map((r) => ({ id: r.id, status: r.status, summary: r.summary }));
  if (!trust.assigned) return { status: "refused", httpStatus: 422, reason: `Verification failed: ${trust.failedConditions.join("; ")}.`, checks };

  /* 4 — recalculate; never use a client-supplied avoided figure */
  let carbon: CarbonResult;
  try {
    carbon = calculateJourney({ mode: t.mode, distanceKm, vehicle: t.vehicle?.spec as VehicleEnergySpec | undefined, occupants: t.occupants, at: t.endedAt });
  } catch (e) {
    return { status: "invalid", httpStatus: 400, reason: e instanceof JourneyInputError ? e.message : "The journey couldn't be calculated.", checks };
  }
  if (!carbon.reward.eligible || carbon.contract.mode === null) return { status: "refused", httpStatus: 422, reason: carbon.reward.reason, carbon, checks };

  /* 5 — duplicates, limits and chain state */
  const routeDigest = keccak256(toHex(samples.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join(";")));
  const tripId = deriveTripId({ commuter: req.commuter, clientTripId: t.clientTripId, startedAt: Math.floor(t.startedAt), endedAt: Math.floor(t.endedAt), routeDigest });
  const day = dayKey(nowMs);
  if (store.countToday(req.commuter, day) >= config.maxTripsPerDay) return { status: "rate-limited", httpStatus: 429, reason: `Daily limit of ${config.maxTripsPerDay} signed journeys reached for this commuter.`, carbon, checks };

  try {
    const [oracleOnChain, processed, nonce] = await Promise.all([reader.oracleSigner(), reader.isTripProcessed(tripId), reader.nonceOf(req.commuter)]);
    if (oracleOnChain.toLowerCase() !== oracleAddressOf(config.oracleKey).toLowerCase()) {
      return { status: "unavailable", httpStatus: 503, reason: "The configured oracle key isn't the contract's azureOracleSigner. A signature from it would be rejected on-chain, so nothing was signed.", checks };
    }
    if (processed) return { status: "duplicate", httpStatus: 409, reason: "This trip is already recorded on-chain.", carbon, checks };

    const deadline = Math.floor(nowMs / 1000) + config.signatureTtlSeconds;
    const payload = { commuter: req.commuter, tripId, mode: carbon.contract.mode, distanceMeters: carbon.distanceMeters, co2AvoidedGrams: carbon.co2AvoidedGrams, nonce, deadline: BigInt(deadline) };
    const signature = await signTripPayload({ privateKey: config.oracleKey, chainId: config.chainId, verifyingContract: config.contract, payload });
    store.record(req.commuter, day, tripId);
    return {
      status: "signed",
      httpStatus: 200,
      signed: {
        tripId,
        mode: payload.mode,
        modeName: transportModeName(payload.mode) ?? "UNKNOWN",
        distanceMeters: payload.distanceMeters,
        co2AvoidedGrams: payload.co2AvoidedGrams,
        nonce: nonce.toString(),
        deadline,
        signature,
        oracle: oracleAddressOf(config.oracleKey),
        contract: config.contract,
        chainId: config.chainId,
        signedAt: nowMs,
      },
      carbon,
      distanceKmUsed: distanceKm,
      checks,
    };
  } catch (e) {
    return { status: "unavailable", httpStatus: 503, reason: `The chain couldn't be read (${e instanceof Error ? e.message.slice(0, 120) : "unknown error"}). Nothing was signed.`, checks };
  }
}
