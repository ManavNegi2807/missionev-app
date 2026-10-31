"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { keccak256, toHex } from "viem";
import { loadStatus, postJson } from "@/lib/api/client";
import { calculateJourney, JourneyInputError } from "@/lib/carbon/emissionsEngine";
import { mevNumber, mintedInReceipt, readCommuterOnChain, readNonce, sendRecordCommute, waitForReceipt } from "@/lib/contract/client";
import { CONTRACT, isContractAddress } from "@/lib/contract/config";
import { PORTAL_V3 } from "@/lib/chain";
import { oracleRequestMessage } from "@/lib/oracle/walletProof";
import { previewReward, streakAfterTrip } from "@/lib/carbon/rewardPreview";
import type { CarbonResult } from "@/lib/carbon/types";
import { createSessionStore } from "@/lib/session-store";
import { downsample, haversineKm } from "@/lib/trip/geo";
import { DEMO_ROUTES, getRoute, type DemoRoute } from "@/lib/trip/demo-routes";
import { transition, type TripEvent } from "@/lib/trip/machine";
import { SIM_SCALE, seedFromId, simSample, simSpeedKmh } from "@/lib/trip/simulator";
import { TRAVEL_LABEL, isPrivateMode, speedClassOf } from "@/lib/trip/travel";
import {
  NOT_STARTED,
  type ApplicationMode,
  type CheckId,
  type CheckResult,
  type GpsSample,
  type Scenario,
  type Settlement,
  type SignedTrip,
  type TravelMode,
  type TripRecord,
  type TripSource,
  type TripStatus,
  type TripVehicle,
  type TrustResult,
} from "@/lib/trip/types";
import { assignTrust, checkMotion, checkRideLog, checkRoute, checkVehicle, fingerprintOf, type VerifyContext } from "@/lib/trip/verification";
import { vehicleSpecOf, vehiclesForJourney, type TransportProfile } from "@/lib/transport/profile";
import { EMPTY_RIDE, resolveRideHail, type RideHailForm } from "@/lib/transport/rideHail";
import { useOnboarding } from "./onboarding-provider";
import { useWallet } from "./wallet-provider";

const TICK_MS = 250;

export interface TripSetup {
  source: TripSource;
  routeId: string;
  scenario: Scenario;
  /** How the commuter is travelling on THIS journey. Chosen per trip; never inferred from what they own. */
  mode: TravelMode;
  /** The saved vehicle for a private journey. null = the first matching one. */
  vehicleId: string | null;
  /** Ride-hail receipt details and the vehicle the commuter confirmed. */
  ride: RideHailForm;
}

export type GpsSignal = "idle" | "requesting" | "strong" | "good" | "weak" | "poor" | "denied" | "unavailable" | "simulated";

export interface LiveTrip {
  tripId: string | null;
  startedAt: number | null;
  samples: GpsSample[];
  distanceKm: number;
  /** Real milliseconds spent in RECORDING. */
  activeMs: number;
  /** Simulated seconds elapsed (simulated trips only). */
  simSec: number;
  routeProgressKm: number;
  currentSpeedKmh: number;
  maxSpeedKmh: number;
  lastAccuracy: number | null;
  /** First sample after a resume only re-anchors the position; the paused gap isn't counted. */
  resumePending: boolean;
}

const EMPTY_LIVE: LiveTrip = {
  tripId: null,
  startedAt: null,
  samples: [],
  distanceKm: 0,
  activeMs: 0,
  simSec: 0,
  routeProgressKm: 0,
  currentSpeedKmh: 0,
  maxSpeedKmh: 0,
  lastAccuracy: null,
  resumePending: false,
};

export interface VerifyState {
  checks: Record<CheckId, CheckResult>;
  running: CheckId | "3.5" | null;
  /** 0–5: completed stages (four checks + trust assignment). */
  step: number;
  trust: TrustResult | null;
}

const pendingCheck = (id: CheckId): CheckResult => ({ id, status: "pending", isDemo: false, summary: "", items: [], technical: {}, at: null });
const INITIAL_VERIFY: VerifyState = {
  checks: { "3.1": pendingCheck("3.1"), "3.2": pendingCheck("3.2"), "3.3": pendingCheck("3.3"), "3.4": pendingCheck("3.4") },
  running: null,
  step: 0,
  trust: null,
};

export interface Notice {
  tone: "warn" | "err" | "cyan" | "ok";
  text: string;
  /** Offer to continue as a clearly-labelled simulated trip. */
  offerSimulation?: boolean;
}

/* ---- D2 · Trips & Telemetry (session history; routes are stripped, coordinates rounded) ---- */
const historyStore = createSessionStore<TripRecord[]>("missionev:d2:trips", []);
const persistable = (r: TripRecord): TripRecord => {
  const copy = { ...r };
  delete copy.path;
  return copy;
};
/** Trips saved by an older build (before per-journey transport and settlement) have a different shape; they are ignored rather than half-read. */
const isCurrentTrip = (t: TripRecord) => typeof t.mode === "string" && typeof t.settlement === "object" && t.settlement !== null;

/** Which vehicle (if any) a journey will use, and why a journey can't start yet. */
function resolveSelection(setup: TripSetup, transport: TransportProfile | null): { vehicle: TripVehicle | null; blocked: string | null } {
  if (setup.mode === "ride_hail") {
    const r = resolveRideHail(setup.ride);
    if (!r.vehicle) return { vehicle: null, blocked: "Add the ride's details from your receipt (or enter them by hand), then confirm the vehicle and fuel." };
    if (!setup.ride.confirmed) return { vehicle: r.vehicle, blocked: "Confirm the ride details. A receipt can't prove the vehicle or its fuel, so you have the last word." };
    return { vehicle: r.vehicle, blocked: null };
  }
  if (!isPrivateMode(setup.mode)) return { vehicle: null, blocked: null };
  const options = vehiclesForJourney(transport, setup.mode);
  const chosen = options.find((v) => v.id === setup.vehicleId) ?? options[0];
  if (!chosen) return { vehicle: null, blocked: `No ${TRAVEL_LABEL[setup.mode].toLowerCase()} in your transport profile. Add one on Screen 01, or choose another way you travelled.` };
  return { vehicle: { id: chosen.id, label: [chosen.manufacturer, chosen.model, chosen.variant].filter(Boolean).join(" "), spec: vehicleSpecOf(chosen) }, blocked: null };
}

/** The contract's streak state as the demo would have it, replaying this tab's demo-credited trips in order. */
function demoCommuterState(history: TripRecord[]) {
  let streakDays = 0;
  let lastTripTimestamp = 0;
  for (const t of history.filter((h) => h.settlement.phase === "demo-credited").sort((a, b) => a.endedAt - b.endedAt)) {
    const sec = Math.floor(t.endedAt / 1000);
    streakDays = streakAfterTrip({ streakDays, lastTripTimestamp }, sec);
    lastTripTimestamp = sec;
  }
  return { streakDays, lastTripTimestamp };
}

const rpcCode = (e: unknown): number | undefined => (typeof e === "object" && e !== null && "code" in e ? Number((e as { code: unknown }).code) : undefined);

interface TripContextValue {
  status: TripStatus;
  setup: TripSetup;
  setSetup(patch: Partial<TripSetup>): void;
  setRide(patch: Partial<RideHailForm>): void;
  /** The vehicle the current setup resolves to, and why a trip can't start yet (null = ready). */
  selection: { vehicle: TripVehicle | null; blocked: string | null };
  route: DemoRoute;
  gps: { signal: GpsSignal; message: string | null };
  live: LiveTrip;
  record: TripRecord | null;
  verify: VerifyState;
  notice: Notice | null;
  dismissNotice(): void;
  history: TripRecord[];
  latest: TripRecord | null;
  start(override?: Partial<TripSetup>): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  verifyTrip(): Promise<void>;
  reset(): void;
  clearHistory(): void;
  /** DEMO: credit the previewed reward in this browser only. Nothing is minted. */
  claimDemo(): void;
  /** LIVE: ask the oracle to verify and sign this journey (the wallet signs a free proof message first). */
  requestSignature(): Promise<void>;
  /** LIVE: send `recordCommute` from the commuter's own wallet with the oracle's signature. */
  submitOnChain(): Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const signalFor = (acc: number): GpsSignal => (acc <= 15 ? "strong" : acc <= 35 ? "good" : acc <= 100 ? "weak" : "poor");
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function TripProvider({ children }: { children: ReactNode }) {
  const { registration } = useOnboarding();
  const wallet = useWallet();
  const storedHistory = useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot, historyStore.getServerSnapshot);
  const history = useMemo(() => storedHistory.filter(isCurrentTrip), [storedHistory]);

  const [status, setStatus] = useState<TripStatus>("IDLE");
  const [chosen, setSetupState] = useState<TripSetup>({ source: "gps", routeId: DEMO_ROUTES[0].id, scenario: "clean", mode: "metro", vehicleId: null, ride: EMPTY_RIDE });
  const setup = chosen;
  const transport = registration?.transport ?? null;
  const selection = useMemo(() => resolveSelection(setup, transport), [setup, transport]);
  const [gps, setGps] = useState<{ signal: GpsSignal; message: string | null }>({ signal: "idle", message: null });
  const [live, setLive] = useState<LiveTrip>(EMPTY_LIVE);
  const [record, setRecord] = useState<TripRecord | null>(null);
  const [verify, setVerify] = useState<VerifyState>(INITIAL_VERIFY);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Mutable mirrors so timers / geolocation callbacks never read stale state.
  const statusRef = useRef<TripStatus>("IDLE");
  const setupRef = useRef(setup);
  const selectionRef = useRef(selection);
  const liveRef = useRef<LiveTrip>(EMPTY_LIVE);
  const recordRef = useRef<TripRecord | null>(null);
  const registrationRef = useRef(registration);
  const walletRef = useRef(wallet);
  const historyRef = useRef(history);
  const runRef = useRef(0);
  const startingRef = useRef(false);
  const lastTickRef = useRef(0);

  useEffect(() => {
    setupRef.current = setup;
    selectionRef.current = selection;
    registrationRef.current = registration;
    walletRef.current = wallet;
    historyRef.current = history;
  });

  const fire = useCallback((ev: TripEvent): boolean => {
    const next = transition(statusRef.current, ev);
    if (!next) return false;
    statusRef.current = next;
    setStatus(next);
    return true;
  }, []);

  const pushLive = useCallback((next: LiveTrip) => {
    liveRef.current = next;
    setLive(next);
  }, []);

  const setSetup = useCallback((patch: Partial<TripSetup>) => {
    if (statusRef.current !== "IDLE") return;
    setSetupState((s) => {
      const next = { ...s, ...patch };
      setupRef.current = next;
      return next;
    });
  }, []);

  const setRide = useCallback((patch: Partial<RideHailForm>) => {
    if (statusRef.current !== "IDLE") return;
    setSetupState((s) => {
      // Editing any detail withdraws the confirmation: the commuter confirms what is on screen now.
      const next = { ...s, ride: { ...s.ride, ...patch, ...("confirmed" in patch ? {} : { confirmed: false }) } };
      setupRef.current = next;
      return next;
    });
  }, []);

  /* ------------------------------ lifecycle actions ------------------------------ */
  const begin = useCallback(
    (makeFirst: (tripId: string, startedAt: number) => GpsSample) => {
      const tripId = `trip_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
      const startedAt = Date.now();
      const first = makeFirst(tripId, startedAt);
      pushLive({ ...EMPTY_LIVE, tripId, startedAt, samples: [first], currentSpeedKmh: first.speedKmh, lastAccuracy: first.accuracy ?? null });
      setRecord(null);
      recordRef.current = null;
      setVerify(INITIAL_VERIFY);
      fire("START");
    },
    [fire, pushLive],
  );

  const start = useCallback(
    async (override?: Partial<TripSetup>) => {
      if (statusRef.current !== "IDLE" || startingRef.current || !registrationRef.current) return;
      const s = { ...setupRef.current, ...override };
      const sel = resolveSelection(s, registrationRef.current.transport);
      if (sel.blocked) {
        setNotice({ tone: "warn", text: sel.blocked });
        return;
      }
      setupRef.current = s;
      selectionRef.current = sel;
      setSetupState(s);
      setNotice(null);

      if (s.source === "simulated") {
        const route = getRoute(s.routeId);
        setGps({ signal: "simulated", message: "Simulated movement — no GPS is being read." });
        begin((tripId, t0) =>
          simSample({ route, progressKm: 0, tMs: t0, seed: seedFromId(tripId), index: 0, scenario: s.scenario, prevT: null, speedKmh: 0 }),
        );
        return;
      }

      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        setGps({ signal: "unavailable", message: "This browser has no Geolocation API." });
        setNotice({ tone: "warn", text: "GPS isn't available in this browser. No location data was collected.", offerSimulation: true });
        return;
      }
      startingRef.current = true;
      setGps({ signal: "requesting", message: "Waiting for your browser's location permission…" });
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const acc = pos.coords.accuracy;
            setGps({ signal: signalFor(acc), message: null });
            begin(() => ({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              t: pos.timestamp,
              speedKmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : 0,
              accuracy: acc,
            }));
            resolve();
          },
          (err) => {
            const denied = err.code === err.PERMISSION_DENIED;
            setGps({ signal: denied ? "denied" : "unavailable", message: err.message || null });
            setNotice({
              tone: "warn",
              text: denied
                ? "Location permission was denied, so no GPS data is being collected. You can run a clearly-labelled simulated trip instead."
                : "Your device couldn't provide a location (" + (err.message || "unavailable") + "). No GPS data was collected.",
              offerSimulation: true,
            });
            resolve();
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
        );
      });
      startingRef.current = false;
    },
    [begin],
  );

  const pause = useCallback(() => {
    fire("PAUSE");
  }, [fire]);

  const resume = useCallback(() => {
    if (fire("RESUME")) pushLive({ ...liveRef.current, resumePending: true });
  }, [fire, pushLive]);

  const stop = useCallback(() => {
    const reg = registrationRef.current;
    const l = liveRef.current;
    if (!reg || !l.tripId || !l.startedAt) return;
    if (!fire("STOP")) return;
    const s = setupRef.current;
    const sel = selectionRef.current;
    const w = walletRef.current;
    const durationSec = s.source === "gps" ? l.activeMs / 1000 : l.simSec;
    const samples = l.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const ride = s.mode === "ride_hail" ? resolveRideHail(s.ride) : null;
    const rec: TripRecord = {
      id: l.tripId,
      status: "COMPLETED",
      source: s.source,
      mode: s.mode,
      isSimulated: s.source === "simulated",
      scenario: s.scenario,
      routeId: s.source === "simulated" ? s.routeId : null,
      routeName: s.source === "simulated" ? getRoute(s.routeId).name : null,
      startedAt: l.startedAt,
      endedAt: s.source === "gps" ? Date.now() : l.startedAt + l.simSec * 1000,
      distanceKm: l.distanceKm,
      durationSec,
      avgSpeedKmh: durationSec > 0 ? l.distanceKm / (durationSec / 3600) : 0,
      maxSpeedKmh: l.maxSpeedKmh,
      sampleCount: samples.length,
      start: first ? { lat: round3(first.lat), lng: round3(first.lng) } : { lat: 0, lng: 0 },
      end: last ? { lat: round3(last.lat), lng: round3(last.lng) } : { lat: 0, lng: 0 },
      speedProfile: downsample(samples.map((p) => Math.round(p.speedKmh * 10) / 10), 40),
      fingerprint: fingerprintOf(samples),
      routeDigest: "",
      salt: Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join(""),
      vehicle: sel.vehicle,
      rideHail: ride?.info ?? null,
      wallet: {
        address: w.address ?? reg.wallet.address,
        chainId: w.chainId ?? reg.wallet.chainId,
        mode: w.isConnected ? (w.isDemo ? "demo" : "browser") : reg.wallet.mode,
      },
      userId: reg.userId,
      verification: null,
      carbon: null,
      settlement: NOT_STARTED,
      path: downsample(samples.map((p) => ({ lat: p.lat, lng: p.lng })), 160),
    };
    recordRef.current = rec;
    setRecord(rec);
  }, [fire]);

  const persist = useCallback((rec: TripRecord) => {
    const others = historyRef.current.filter((r) => r.id !== rec.id);
    historyStore.set([persistable(rec), ...others].slice(0, 20));
  }, []);

  /** Replace the current record, mirror it to state and (when it has been verified) to history. */
  const commit = useCallback(
    (next: TripRecord) => {
      recordRef.current = next;
      setRecord(next);
      if (next.status === "VERIFIED" || next.status === "FAILED") persist(next);
    },
    [persist],
  );

  const patchSettlement = useCallback(
    (patch: Partial<Settlement>) => {
      const rec = recordRef.current;
      if (!rec) return;
      commit({ ...rec, settlement: { ...rec.settlement, ...patch } });
    },
    [commit],
  );

  const verifyTrip = useCallback(async () => {
    const rec = recordRef.current;
    if (!rec || !fire("VERIFY")) return;
    const token = ++runRef.current;
    const ctx: VerifyContext = {
      tripId: rec.id,
      source: rec.source,
      scenario: rec.scenario,
      mode: rec.mode,
      route: rec.routeId ? getRoute(rec.routeId) : null,
      samples: liveRef.current.samples,
      distanceKm: rec.distanceKm,
      durationSec: rec.durationSec,
      vehicle: rec.vehicle,
      rideHail: rec.rideHail,
      knownFingerprints: historyRef.current.filter((h) => h.id !== rec.id).map((h) => ({ id: h.id, fingerprint: h.fingerprint })),
    };
    setVerify({ ...INITIAL_VERIFY, running: "3.1" });

    const plan: Array<[CheckId, (c: VerifyContext) => CheckResult, number]> = [
      ["3.1", checkVehicle, 1000],
      ["3.2", checkRideLog, 1100],
      ["3.3", checkMotion, 1200],
      ["3.4", checkRoute, 1200],
    ];
    const done: Record<string, CheckResult> = {};
    for (let i = 0; i < plan.length; i++) {
      const [id, fn, ms] = plan[i];
      setVerify((v) => ({ ...v, running: id, step: i }));
      await sleep(ms);
      if (token !== runRef.current) return;
      const result = { ...fn(ctx), at: Date.now() };
      done[id] = result;
      setVerify((v) => ({ ...v, checks: { ...v.checks, [id]: result }, step: i + 1 }));
    }
    setVerify((v) => ({ ...v, running: "3.5" }));
    await sleep(900);
    if (token !== runRef.current) return;

    const checks = done as Record<CheckId, CheckResult>;
    const trust = assignTrust(checks);
    setVerify((v) => ({ ...v, running: null, step: 5, trust }));

    let ok = trust.assigned;
    let carbon: CarbonResult | null = null;
    if (ok) {
      try {
        carbon = calculateJourney({ mode: rec.mode, distanceKm: rec.distanceKm, vehicle: rec.vehicle?.spec, occupants: rec.rideHail?.occupants, at: rec.endedAt });
      } catch (e) {
        ok = false;
        setNotice({ tone: "err", text: e instanceof JourneyInputError ? e.message : "The journey couldn't be calculated." });
      }
    }

    // DEMO or LIVE is decided once, here: real GPS + a real wallet on Portal V3 + a fully configured server = LIVE.
    const w = walletRef.current;
    const server = await loadStatus();
    const liveMode = ok && rec.source === "gps" && server?.mode === "LIVE" && w.mode === "browser" && w.onExpectedChain && Boolean(w.address) && isContractAddress(CONTRACT.address) && Boolean(carbon?.reward.eligible);
    const applicationMode: ApplicationMode = liveMode ? "LIVE" : "DEMO";

    // What the contract's reward formula would mint, from the commuter's real streak (LIVE) or this tab's demo history.
    let preview: Settlement["preview"];
    if (ok && carbon?.reward.eligible && carbon.contract.mode !== null) {
      let state = demoCommuterState(historyRef.current);
      if (liveMode) {
        try {
          const c = await readCommuterOnChain(w.request, CONTRACT.address as `0x${string}`, w.address as `0x${string}`);
          state = { streakDays: c.streakDays, lastTripTimestamp: c.lastTripTimestamp };
        } catch {
          /* fall back to the demo estimate; the preview is labelled as a preview */
        }
      }
      const p = previewReward({ commuter: state, mode: carbon.contract.mode, co2AvoidedGrams: carbon.co2AvoidedGrams, nowSec: Math.floor(Date.now() / 1000) });
      preview = { rewardMev: mevNumber(p.rewardWei), streakDays: p.streakDays, formula: p.formula };
    }

    const samples = liveRef.current.samples;
    const routeDigest = keccak256(toHex(samples.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";")));
    const final: TripRecord = {
      ...rec,
      routeDigest,
      status: ok ? "VERIFIED" : "FAILED",
      verification: { checks, trust },
      carbon,
      settlement: { ...NOT_STARTED, applicationMode, preview },
    };
    fire(ok ? "PASS" : "FAIL");
    commit(final);
  }, [fire, commit]);

  const reset = useCallback(() => {
    runRef.current++;
    startingRef.current = false;
    fire("RESET");
    pushLive(EMPTY_LIVE);
    recordRef.current = null;
    setRecord(null);
    setVerify(INITIAL_VERIFY);
    setGps({ signal: "idle", message: null });
    setNotice(null);
  }, [fire, pushLive]);

  const clearHistory = useCallback(() => historyStore.set([]), []);

  /* ------------------------------ settlement ------------------------------ */
  const claimDemo = useCallback(() => {
    const rec = recordRef.current;
    if (!rec?.carbon?.reward.eligible || rec.settlement.phase !== "not-started") return;
    patchSettlement({ applicationMode: "DEMO", phase: "demo-credited", demo: { creditedMev: rec.settlement.preview?.rewardMev ?? 0, at: Date.now() } });
  }, [patchSettlement]);

  const requestSignature = useCallback(async () => {
    const rec = recordRef.current;
    const w = walletRef.current;
    if (!rec || rec.settlement.applicationMode !== "LIVE" || !rec.carbon?.reward.eligible) return;
    const address = w.address;
    if (w.mode !== "browser" || !address || !w.onExpectedChain || !isContractAddress(CONTRACT.address)) {
      patchSettlement({ oracle: { status: "error", reason: `Connect your wallet on ${PORTAL_V3.name} first.` } });
      return;
    }
    const samples = liveRef.current.samples;
    if (liveRef.current.tripId !== rec.id || samples.length < 2) {
      patchSettlement({ oracle: { status: "unavailable", reason: "This trip's location samples are gone (the page was reloaded). Record a new trip to request a signature." } });
      return;
    }
    patchSettlement({ phase: "not-started", oracle: { status: "requesting" }, tx: { status: "none" } });

    // 1 — a free personal_sign proves the request comes from the holder of this address, for this trip only.
    const message = oracleRequestMessage({ commuter: address, clientTripId: rec.id, contract: CONTRACT.address, chainId: PORTAL_V3.chainId, issuedAt: Date.now() });
    let signature: string;
    try {
      signature = (await w.request("personal_sign", [toHex(message), address])) as string;
    } catch (e) {
      patchSettlement({ oracle: { status: "error", reason: rpcCode(e) === 4001 ? "You declined the signature request. Nothing was sent to the oracle." : "The wallet couldn't sign the request." } });
      return;
    }

    // 2 — the oracle re-verifies the evidence, recalculates, and signs only what it derived.
    const res = await postJson<{ status: string; reason?: string; signed?: SignedTrip }>("/api/oracle/sign-trip", {
      commuter: address,
      proof: { message, signature },
      trip: {
        clientTripId: rec.id,
        mode: rec.mode,
        source: rec.source,
        startedAt: rec.startedAt,
        endedAt: rec.endedAt,
        distanceKm: rec.distanceKm,
        durationSec: rec.durationSec,
        samples: samples.map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6, p.t, Math.round(p.speedKmh * 10) / 10]),
        vehicle: rec.vehicle,
        rideHail: rec.rideHail,
        occupants: rec.rideHail?.occupants ?? 1,
      },
    }).catch(() => null);

    if (!res) return patchSettlement({ oracle: { status: "unavailable", reason: "The oracle couldn't be reached. Nothing was signed." } });
    if (res.data.status === "signed" && res.data.signed) return patchSettlement({ phase: "signed", oracle: { status: "signed", signed: res.data.signed } });
    const unavailable = res.data.status === "unavailable";
    patchSettlement({ phase: unavailable ? "not-started" : "refused", oracle: { status: unavailable ? "unavailable" : "refused", reason: res.data.reason ?? "The oracle declined to sign this journey." } });
  }, [patchSettlement]);

  const submitOnChain = useCallback(async () => {
    const rec = recordRef.current;
    const w = walletRef.current;
    const signed = rec?.settlement.oracle.signed;
    if (!rec || !signed || rec.settlement.applicationMode !== "LIVE") return;
    if (w.mode !== "browser" || !w.address || !w.onExpectedChain) {
      return patchSettlement({ tx: { status: "error", error: `Connect your wallet on ${PORTAL_V3.name} first.` } });
    }
    if (w.address.toLowerCase() !== rec.wallet.address.toLowerCase()) {
      return patchSettlement({ tx: { status: "error", error: "The connected wallet isn't the one this journey was signed for. The contract credits whoever sends the transaction, so switch back." } });
    }
    if (signed.deadline * 1000 < Date.now() + 5000) {
      return patchSettlement({ phase: "not-started", oracle: { status: "error", reason: "The signature has expired. Request a fresh one." }, tx: { status: "none" } });
    }
    try {
      // A signature is bound to the commuter's current nonce: if it moved, the signature can only revert.
      const nonce = await readNonce(w.request, signed.contract as `0x${string}`, w.address as `0x${string}`);
      if (nonce.toString() !== signed.nonce) {
        return patchSettlement({ phase: "not-started", oracle: { status: "error", reason: "Your wallet's nonce moved since this was signed. Request a fresh signature." }, tx: { status: "none" } });
      }
    } catch {
      /* the transaction itself will fail loudly if the chain is unreachable */
    }

    patchSettlement({ phase: "wallet-pending", tx: { status: "awaiting-wallet" } });
    let hash: string;
    try {
      hash = await sendRecordCommute(w.request, { from: w.address, contract: signed.contract, signed });
    } catch (e) {
      return patchSettlement({ phase: "signed", tx: { status: rpcCode(e) === 4001 ? "rejected" : "error", error: rpcCode(e) === 4001 ? "You rejected the transaction in your wallet." : "The wallet couldn't send the transaction." } });
    }
    patchSettlement({ phase: "wallet-pending", tx: { status: "pending", hash } });
    const receipt = await waitForReceipt(w.request, hash);
    if (!receipt) return patchSettlement({ tx: { status: "pending", hash, error: "Still waiting for a receipt. Check the explorer, then reload this page." } });
    if (receipt.status === "reverted") {
      return patchSettlement({ phase: "failed", tx: { status: "reverted", hash, blockNumber: receipt.blockNumber, error: "The contract rejected the transaction (the signature may be stale, expired or the trip already recorded)." } });
    }
    // Exact amounts come from the receipt and the contract, never from the event's truncated pointsMinted.
    const minted = mintedInReceipt(receipt, signed.contract, w.address);
    const after = await readCommuterOnChain(w.request, signed.contract as `0x${string}`, w.address as `0x${string}`).catch(() => null);
    patchSettlement({
      phase: "confirmed",
      tx: { status: "confirmed", hash, blockNumber: receipt.blockNumber },
      onchain: after
        ? { mintedWei: minted.toString(), balanceWei: after.balanceWei.toString(), streakDays: after.streakDays, carbonScore: after.carbonScore, totalAvoidedGrams: after.totalAvoidedGramsCO2, readAt: Date.now() }
        : undefined,
    });
  }, [patchSettlement]);

  /**
   * DEMO or LIVE is first decided when a trip is verified, but a commuter may connect their wallet (or the server status may
   * arrive) afterwards. Until a settlement step has actually started, re-evaluate it so connecting a wallet makes the finished
   * trip recordable, and adopt that wallet as the commuter the oracle will sign for.
   */
  useEffect(() => {
    const rec = record;
    if (!rec || rec.status !== "VERIFIED" || !rec.carbon?.reward.eligible || rec.settlement.phase !== "not-started" || rec.settlement.oracle.status !== "not-requested") return;
    let cancelled = false;
    void (async () => {
      const server = await loadStatus();
      const liveNow = rec.source === "gps" && server?.mode === "LIVE" && wallet.mode === "browser" && wallet.onExpectedChain && Boolean(wallet.address) && isContractAddress(CONTRACT.address);
      const wanted: ApplicationMode = liveNow ? "LIVE" : "DEMO";
      if (cancelled || recordRef.current?.id !== rec.id) return;
      const sameWallet = !liveNow || rec.wallet.address.toLowerCase() === wallet.address?.toLowerCase();
      if (wanted === rec.settlement.applicationMode && sameWallet) return;
      let preview = rec.settlement.preview;
      if (liveNow && rec.carbon?.contract.mode != null) {
        try {
          const c = await readCommuterOnChain(wallet.request, CONTRACT.address as `0x${string}`, wallet.address as `0x${string}`);
          const p = previewReward({ commuter: c, mode: rec.carbon.contract.mode, co2AvoidedGrams: rec.carbon.co2AvoidedGrams, nowSec: Math.floor(Date.now() / 1000) });
          preview = { rewardMev: mevNumber(p.rewardWei), streakDays: p.streakDays, formula: p.formula };
        } catch {
          /* keep the earlier preview */
        }
      }
      const latest = recordRef.current;
      if (cancelled || !latest || latest.id !== rec.id || latest.settlement.phase !== "not-started") return;
      commit({
        ...latest,
        wallet: liveNow ? { address: wallet.address as string, chainId: wallet.chainId, mode: "browser" } : latest.wallet,
        settlement: { ...latest.settlement, applicationMode: wanted, preview },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [record, wallet.mode, wallet.address, wallet.chainId, wallet.onExpectedChain, wallet.request, commit]);

  /* ------------------------------ engines ------------------------------ */
  // Simulation + active-time ticker.
  useEffect(() => {
    if (status !== "RECORDING") return;
    lastTickRef.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1000, now - lastTickRef.current);
      lastTickRef.current = now;
      const l = liveRef.current;
      const s = setupRef.current;
      const reg = registrationRef.current;
      const next: LiveTrip = { ...l, activeMs: l.activeMs + dt };

      if (s.source === "simulated" && reg && l.tripId) {
        const route = getRoute(s.routeId);
        const seed = seedFromId(l.tripId);
        const dtSim = (dt / 1000) * SIM_SCALE;
        const speed = simSpeedKmh(speedClassOf(s.mode, selectionRef.current.vehicle?.spec.body), seed, l.routeProgressKm, route.lengthKm);
        const progress = Math.min(route.lengthKm, l.routeProgressKm + (speed * dtSim) / 3600);
        const prev = l.samples[l.samples.length - 1];
        const sample = simSample({
          route,
          progressKm: progress,
          tMs: (l.startedAt ?? 0) + (l.simSec + dtSim) * 1000,
          seed,
          index: l.samples.length,
          scenario: s.scenario,
          prevT: prev?.t ?? null,
          speedKmh: speed,
        });
        next.samples = [...l.samples, sample];
        next.distanceKm = l.distanceKm + (prev ? haversineKm(prev, sample) : 0);
        next.simSec = l.simSec + dtSim;
        next.routeProgressKm = progress;
        next.currentSpeedKmh = speed;
        next.maxSpeedKmh = Math.max(l.maxSpeedKmh, speed);
        pushLive(next);
        if (progress >= route.lengthKm) {
          setNotice({ tone: "cyan", text: "The simulated vehicle reached its destination, so the trip was stopped." });
          stop();
        }
        return;
      }
      pushLive(next);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status, pushLive, stop]);

  // Real GPS watch — only exists while RECORDING a GPS trip (permission was already granted by Start).
  useEffect(() => {
    if (status !== "RECORDING" || setupRef.current.source !== "gps" || !("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const l = liveRef.current;
        const acc = pos.coords.accuracy;
        setGps({ signal: signalFor(acc), message: null });
        const sample: GpsSample = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp,
          speedKmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : 0,
          accuracy: acc,
        };
        const prev = l.samples[l.samples.length - 1];
        // Browsers can re-deliver the same fix (e.g. the first watch callback repeats getCurrentPosition).
        // Drop it so honest GPS isn't mistaken for a replayed trace by the duplicate-timestamp rule.
        if (prev && sample.t <= prev.t) return;
        if (acc > 100) {
          pushLive({ ...l, lastAccuracy: acc });
          return;
        }
        let distanceKm = l.distanceKm;
        let speed = sample.speedKmh;
        if (prev) {
          const d = haversineKm(prev, sample);
          const dtSec = (sample.t - prev.t) / 1000;
          const derived = dtSec > 0 ? (d / dtSec) * 3600 : 0;
          if (pos.coords.speed == null) speed = derived;
          sample.speedKmh = speed;
          // Ignore GPS jitter and impossible jumps.
          if (!l.resumePending && d * 1000 >= Math.max(3, acc * 0.3) && derived <= 250) distanceKm += d;
        }
        pushLive({
          ...l,
          samples: [...l.samples, sample],
          distanceKm,
          currentSpeedKmh: speed,
          maxSpeedKmh: Math.max(l.maxSpeedKmh, speed),
          lastAccuracy: acc,
          resumePending: false,
        });
      },
      (err) => {
        setGps({ signal: err.code === err.PERMISSION_DENIED ? "denied" : "poor", message: err.message || null });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [status, pushLive]);

  useEffect(
    () => () => {
      runRef.current++;
    },
    [],
  );

  const value = useMemo<TripContextValue>(
    () => ({
      status,
      setup,
      setSetup,
      setRide,
      selection,
      route: getRoute(setup.routeId),
      gps,
      live,
      record,
      verify,
      notice,
      dismissNotice: () => setNotice(null),
      history,
      latest: history[0] ?? null,
      start,
      pause,
      resume,
      stop,
      verifyTrip,
      reset,
      clearHistory,
      claimDemo,
      requestSignature,
      submitOnChain,
    }),
    [status, setup, setSetup, setRide, selection, gps, live, record, verify, notice, history, start, pause, resume, stop, verifyTrip, reset, clearHistory, claimDemo, requestSignature, submitOnChain],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used inside <TripProvider>");
  return ctx;
}
