import { beforeEach, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { TRANSPORT_MODE } from "@/lib/carbon/contractMapping";
import { previewReward } from "@/lib/carbon/rewardPreview";
import type { VehicleEnergySpec } from "@/lib/carbon/types";
import { oracleRequestMessage } from "@/lib/oracle/walletProof";
import type { RideHailInfo, TripVehicle } from "@/lib/trip/types";
import type { ChainReader } from "@/server/chainReader";
import type { ServerConfig } from "@/server/config";
import { createMemoryStore, evaluateAndSign, parseSignRequest, type SignRequest } from "@/server/signService";
import { MISSIONEV_ABI, artifact, createChain, type Chain } from "./helpers/evm";

const oracleKey = generatePrivateKey();
const oracle = privateKeyToAccount(oracleKey);
const deployer = privateKeyToAccount(generatePrivateKey()).address;

interface Env { chain: Chain; contract: Hex; config: ServerConfig; reader: ChainReader; deps: Parameters<typeof evaluateAndSign>[1] }

async function env(overrides: Partial<ServerConfig> = {}, signerOnChain: Hex = oracle.address): Promise<Env> {
  const chain = await createChain();
  const contract = await chain.deploy({ from: deployer, abi: MISSIONEV_ABI, bytecode: artifact.bytecode as Hex, ctorArgs: [signerOnChain] });
  const read = <T,>(fn: string, args: unknown[] = []) => chain.read<T>({ to: contract, abi: MISSIONEV_ABI, fn, args });
  const reader: ChainReader = {
    nonceOf: (c) => read<bigint>("nonces", [c]),
    isTripProcessed: (id) => read<boolean>("processedTrips", [id]),
    oracleSigner: () => read<Hex>("azureOracleSigner"),
    hasCode: async () => true,
    async commuter(a) {
      const [carbonScore, streakDays, lastTripTimestamp, totalAvoidedGramsCO2, totalTripsLogged, balanceWei] = await read<readonly bigint[]>("getCommuter", [a]);
      return { carbonScore: Number(carbonScore), streakDays: Number(streakDays), lastTripTimestamp: Number(lastTripTimestamp), totalAvoidedGramsCO2: Number(totalAvoidedGramsCO2), totalTripsLogged: Number(totalTripsLogged), balanceWei };
    },
  };
  const config: ServerConfig = { chainId: chain.chainId, contract, rpcUrl: "http://unused.local", oracleKey, signatureTtlSeconds: 600, maxTripsPerDay: 8, vision: null, ...overrides };
  return { chain, contract, config, reader, deps: { config, reader, store: createMemoryStore(), now: () => chain.now * 1000 } };
}

/** A straight 3 km walk-or-drive worth of samples: one fix every 5 s, ~55 m apart (~40 km/h). */
function samples(startMs: number, n = 60, stepDeg = 0.0005): Array<[number, number, number, number]> {
  return Array.from({ length: n }, (_, i) => [28.6 + i * stepDeg, 77.2 + i * stepDeg * 0.3, startMs + i * 5000, 40] as [number, number, number, number]);
}
const pathKm = (s: ReturnType<typeof samples>) => {
  let km = 0;
  for (let i = 1; i < s.length; i++) {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(s[i][0] - s[i - 1][0]);
    const dLng = toRad(s[i][1] - s[i - 1][1]);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(s[i - 1][0])) * Math.cos(toRad(s[i][0])) * Math.sin(dLng / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(a));
  }
  return km;
};

const evCar: VehicleEnergySpec = { body: "car", powertrain: "electric", consumptionKWhPerKm: 0.14, consumptionBasis: "battery", efficiencySource: "user-entered", confidence: "medium", label: "Test EV" };
const petrol: VehicleEnergySpec = { body: "car", powertrain: "petrol", mileageKmPerUnit: 18, efficiencySource: "user-entered", confidence: "medium", label: "Test petrol" };
const veh = (spec: VehicleEnergySpec, id = "veh_1"): TripVehicle => ({ id, label: spec.label ?? "vehicle", spec });

async function request(e: Env, who = privateKeyToAccount(generatePrivateKey()), over: Partial<SignRequest["trip"]> = {}, issuedAt = e.chain.now * 1000, tamper?: (r: SignRequest) => void): Promise<SignRequest> {
  const endedAt = e.chain.now * 1000;
  const s = samples(endedAt - 295_000);
  const clientTripId = `trip_${Math.random().toString(36).slice(2, 10)}`;
  const message = oracleRequestMessage({ commuter: who.address, clientTripId, contract: e.contract, chainId: e.chain.chainId, issuedAt });
  const req: SignRequest = {
    commuter: who.address,
    proof: { message, signature: await who.signMessage({ message }) },
    trip: { clientTripId, mode: "private_ev_car", source: "gps", startedAt: endedAt - 295_000, endedAt, distanceKm: pathKm(s), durationSec: 295, samples: s, vehicle: veh(evCar), rideHail: null, occupants: 1, ...over },
  };
  tamper?.(req);
  return req;
}

const commuterSend = (e: Env, from: Hex, s: { tripId: string; mode: number; distanceMeters: number; co2AvoidedGrams: number; deadline: number; signature: string }) =>
  e.chain.send({ from, to: e.contract, abi: MISSIONEV_ABI, fn: "recordCommute", args: [s.tripId, s.mode, s.distanceMeters, s.co2AvoidedGrams, BigInt(s.deadline), s.signature] });

describe("oracle: sign → the commuter's own wallet submits → the contract mints", () => {
  let e: Env;
  beforeEach(async () => { e = await env(); });

  it("signs an eligible private-EV trip and the real contract accepts it and mints exactly the previewed reward", async () => {
    const who = privateKeyToAccount(generatePrivateKey());
    const out = await evaluateAndSign(await request(e, who), e.deps);
    if (out.status !== "signed") throw new Error(`${out.status}: ${out.reason}`);
    expect(out.signed.mode).toBe(TRANSPORT_MODE.EV_CAR);
    expect(out.signed.contract.toLowerCase()).toBe(e.contract.toLowerCase());
    expect(out.signed.oracle).toBe(oracle.address);
    expect(out.signed.signature).toMatch(/^0x[0-9a-f]{130}$/);
    expect(out.carbon.co2AvoidedGrams).toBe(out.signed.co2AvoidedGrams);
    expect(out.signed.deadline).toBe(e.chain.now + 600);

    const res = await commuterSend(e, who.address, out.signed);
    expect(res).toMatchObject({ ok: true });
    const pre = previewReward({ commuter: { streakDays: 0, lastTripTimestamp: 0 }, mode: out.signed.mode, co2AvoidedGrams: out.signed.co2AvoidedGrams, nowSec: e.chain.now });
    expect(await e.chain.read<bigint>({ to: e.contract, abi: MISSIONEV_ABI, fn: "balanceOf", args: [who.address] })).toBe(pre.rewardWei);
  });

  it("signs the lower of the client's distance and the samples' distance, in whole metres", async () => {
    const who = privateKeyToAccount(generatePrivateKey());
    const r = await request(e, who);
    r.trip.distanceKm = r.trip.distanceKm * 1.05; // client over-reports by 5%: within tolerance, but the safe (lower) value is used
    const out = await evaluateAndSign(r, e.deps);
    if (out.status !== "signed") throw new Error(out.reason);
    expect(out.distanceKmUsed).toBeLessThan(r.trip.distanceKm); // the lower, safer figure
    expect(out.distanceKmUsed).toBeCloseTo(pathKm(r.trip.samples), 3); // the samples' own distance (to the metre)
    expect(out.signed.distanceMeters).toBe(Math.round(out.distanceKmUsed * 1000));
  });

  it("is idempotent for a retried request until the trip is recorded, then reports a duplicate", async () => {
    const who = privateKeyToAccount(generatePrivateKey());
    const r = await request(e, who);
    const a = await evaluateAndSign(r, e.deps);
    const b = await evaluateAndSign(r, e.deps);
    if (a.status !== "signed" || b.status !== "signed") throw new Error("expected both to sign");
    expect(b.signed.tripId).toBe(a.signed.tripId); // same trip id: the contract's processedTrips can block a replay
    await commuterSend(e, who.address, b.signed);
    const c = await evaluateAndSign(r, e.deps);
    expect(c).toMatchObject({ status: "duplicate", httpStatus: 409 });
  });

  it("uses a fresh nonce after the commuter's previous commute (stale signatures can't be reused)", async () => {
    const who = privateKeyToAccount(generatePrivateKey());
    const first = await evaluateAndSign(await request(e, who), e.deps);
    if (first.status !== "signed") throw new Error(first.reason);
    await commuterSend(e, who.address, first.signed);
    const second = await evaluateAndSign(await request(e, who), e.deps);
    if (second.status !== "signed") throw new Error(second.reason);
    expect(first.signed.nonce).toBe("0");
    expect(second.signed.nonce).toBe("1");
  });

  it("never signs for someone else: wrong signer, wrong trip, stale or future proof", async () => {
    const who = privateKeyToAccount(generatePrivateKey());
    const other = privateKeyToAccount(generatePrivateKey());
    const wrongSigner = await request(e, who, {}, undefined, (r) => void (r.commuter = other.address));
    expect(await evaluateAndSign(wrongSigner, e.deps)).toMatchObject({ status: "unauthorized", httpStatus: 401 });
    const wrongTrip = await request(e, who, {}, undefined, (r) => void (r.trip.clientTripId = "trip_other_one"));
    expect(await evaluateAndSign(wrongTrip, e.deps)).toMatchObject({ status: "unauthorized" });
    const stale = await request(e, who, {}, e.chain.now * 1000 - 6 * 60_000);
    expect(await evaluateAndSign(stale, e.deps)).toMatchObject({ status: "unauthorized", reason: expect.stringContaining("expired") });
    const future = await request(e, who, {}, e.chain.now * 1000 + 5 * 60_000);
    expect(await evaluateAndSign(future, e.deps)).toMatchObject({ status: "unauthorized" });
  });

  it("refuses simulated trips and petrol/diesel journeys, and says why", async () => {
    expect(await evaluateAndSign(await request(e, undefined, { source: "simulated" }), e.deps)).toMatchObject({ status: "refused", reason: expect.stringContaining("demo data") });
    const ice = await evaluateAndSign(await request(e, undefined, { mode: "private_petrol_car", vehicle: veh(petrol) }), e.deps);
    expect(ice).toMatchObject({ status: "refused", reason: expect.stringContaining("not rewarded") });
  });

  it("an EV owner who rode in a petrol cab earns nothing; the same cab as an EV earns EV_CAR", async () => {
    const receipt = (km: number): RideHailInfo => ({ provider: "ola", occupants: 1, receipt: { distanceKm: km, tripDate: null, serviceClass: "Prime Sedan", source: "ocr-reviewed", confirmedByUser: true } });
    const r0 = await request(e, undefined, { mode: "ride_hail", vehicle: veh(petrol, "ride-hail") });
    const km = r0.trip.distanceKm;
    const cab = await evaluateAndSign(await request(e, undefined, { mode: "ride_hail", vehicle: veh(petrol, "ride-hail"), rideHail: receipt(km) }), e.deps);
    expect(cab).toMatchObject({ status: "refused", reason: expect.stringContaining("not rewarded") });
    const evCab = await evaluateAndSign(await request(e, undefined, { mode: "ride_hail", vehicle: veh({ ...evCar, label: "EV cab" }, "ride-hail"), rideHail: receipt(km) }), e.deps);
    expect(evCab).toMatchObject({ status: "signed" });
    if (evCab.status === "signed") expect(evCab.signed.mode).toBe(TRANSPORT_MODE.EV_CAR);
  });

  it("refuses a ride-hail journey whose receipt is missing, unconfirmed or far from the GPS distance", async () => {
    const r0 = await request(e, undefined, { mode: "ride_hail", vehicle: veh({ ...evCar, label: "EV cab" }, "ride-hail") });
    const km = r0.trip.distanceKm;
    const mk = (over: Partial<RideHailInfo["receipt"]>): RideHailInfo => ({ provider: "uber", occupants: 1, receipt: { distanceKm: km, tripDate: null, serviceClass: null, source: "manual", confirmedByUser: true, ...over } });
    const base = { mode: "ride_hail" as const, vehicle: veh({ ...evCar, label: "EV cab" }, "ride-hail") };
    expect(await evaluateAndSign(await request(e, undefined, { ...base, rideHail: null }), e.deps)).toMatchObject({ status: "refused" });
    expect(await evaluateAndSign(await request(e, undefined, { ...base, rideHail: mk({ confirmedByUser: false }) }), e.deps)).toMatchObject({ status: "refused" });
    expect(await evaluateAndSign(await request(e, undefined, { ...base, rideHail: mk({ distanceKm: km * 2 }) }), e.deps)).toMatchObject({ status: "refused" });
  });

  it("refuses evidence whose reported distance disagrees with its samples", async () => {
    const out = await evaluateAndSign(await request(e, undefined, { distanceKm: 40 }), e.deps);
    expect(out).toMatchObject({ status: "refused", reason: expect.stringContaining("doesn't match the location samples") });
  });

  it("refuses teleporting or replayed-looking traces", async () => {
    const r = await request(e);
    // One fix jumps ~55 km and back. The server drops impossible jumps from the distance, so the totals still agree and the
    // motion check (3.3) is what refuses it.
    r.trip.samples = r.trip.samples.map((s, i) => (i === 30 ? ([s[0] + 0.5, s[1], s[2], s[3]] as typeof s) : s));
    expect(await evaluateAndSign(r, e.deps)).toMatchObject({ status: "refused", reason: expect.stringContaining("Verification failed") });
  });

  it("walking and metro need no vehicle and are signed with the matching contract modes", async () => {
    const walk = await evaluateAndSign(await request(e, undefined, { mode: "active", vehicle: null, samples: samples(e.chain.now * 1000 - 295_000, 60, 0.00004), distanceKm: pathKm(samples(0, 60, 0.00004)) }), e.deps);
    expect(walk.status === "signed" ? walk.signed.mode : walk).toBe(TRANSPORT_MODE.ACTIVE);
    const metro = await evaluateAndSign(await request(e, undefined, { mode: "metro", vehicle: null }), e.deps);
    expect(metro.status === "signed" ? metro.signed.mode : metro).toBe(TRANSPORT_MODE.METRO);
  });

  it("applies a per-commuter daily limit", async () => {
    const small = await env({ maxTripsPerDay: 2 });
    const who = privateKeyToAccount(generatePrivateKey());
    for (let i = 0; i < 2; i++) expect((await evaluateAndSign(await request(small, who), small.deps)).status).toBe("signed");
    expect(await evaluateAndSign(await request(small, who), small.deps)).toMatchObject({ status: "rate-limited", httpStatus: 429 });
  });

  it("reports 'unavailable' and signs nothing when the oracle isn't configured or its key doesn't match the contract", async () => {
    const noKey = await env({ oracleKey: null });
    expect(await evaluateAndSign(await request(noKey), noKey.deps)).toMatchObject({ status: "unavailable", httpStatus: 503, reason: expect.stringContaining("ORACLE_PRIVATE_KEY") });
    const mismatch = await env({}, privateKeyToAccount(generatePrivateKey()).address);
    expect(await evaluateAndSign(await request(mismatch), mismatch.deps)).toMatchObject({ status: "unavailable", reason: expect.stringContaining("azureOracleSigner") });
  });
});

describe("request validation", () => {
  it("rejects malformed bodies field by field", () => {
    expect(parseSignRequest(null)).toMatchObject({ ok: false });
    expect(parseSignRequest({ commuter: "nope" })).toMatchObject({ ok: false, reason: expect.stringContaining("commuter") });
    const good = { commuter: `0x${"1".repeat(40)}`, proof: { message: "m", signature: `0x${"0".repeat(130)}` }, trip: { clientTripId: "trip_abcd", mode: "metro", source: "gps", startedAt: 1, endedAt: 2, distanceKm: 1, durationSec: 1, samples: [[1, 1, 1, 1], [1, 1, 2, 1]], vehicle: null, rideHail: null, occupants: 1 } };
    expect(parseSignRequest(good)).toMatchObject({ ok: true });
    expect(parseSignRequest({ ...good, trip: { ...good.trip, mode: "teleporter" } })).toMatchObject({ ok: false });
    expect(parseSignRequest({ ...good, trip: { ...good.trip, samples: [[999, 0, 0, 0], [0, 0, 1, 0]] } })).toMatchObject({ ok: false });
    expect(parseSignRequest({ ...good, trip: { ...good.trip, occupants: 99 } })).toMatchObject({ ok: false });
  });
});
