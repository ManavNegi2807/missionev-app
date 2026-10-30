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
import { createSessionStore } from "@/lib/session-store";
import { downsample, haversineKm } from "@/lib/trip/geo";
import { DEMO_ROUTES, getRoute, type DemoRoute } from "@/lib/trip/demo-routes";
import { calculateEmissions } from "@/lib/trip/emissions";
import { buildLedgerPreview } from "@/lib/trip/ledger";
import { transition, type TripEvent } from "@/lib/trip/machine";
import { SIM_SCALE, seedFromId, simSample, simSpeedKmh } from "@/lib/trip/simulator";
import type { CheckId, CheckResult, GpsSample, Scenario, TripRecord, TripSource, TripStatus, TrustResult } from "@/lib/trip/types";import {
  assignTrust,
  checkMotion,
  checkRideLog,
  checkRoute,
  checkVehicle,
  fingerprintOf,
  type VerifyContext,
} from "@/lib/trip/verification";
import { useOnboarding } from "./onboarding-provider";
import { useWallet } from "./wallet-provider";

const TICK_MS = 250;

export interface TripSetup {
  source: TripSource;
  routeId: string;
  scenario: Scenario;
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

interface TripContextValue {
  status: TripStatus;
  setup: TripSetup;
  setSetup(patch: Partial<TripSetup>): void;
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
  previewLedger(): Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const signalFor = (acc: number): GpsSignal => (acc <= 15 ? "strong" : acc <= 35 ? "good" : acc <= 100 ? "weak" : "poor");
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function TripProvider({ children }: { children: ReactNode }) {
  const { registration } = useOnboarding();
  const wallet = useWallet();
  const history = useSyncExternalStore(historyStore.subscribe, historyStore.getSnapshot, historyStore.getServerSnapshot);

  const [status, setStatus] = useState<TripStatus>("IDLE");
  const [setup, setSetupState] = useState<TripSetup>({ source: "gps", routeId: DEMO_ROUTES[0].id, scenario: "clean" });
  const [gps, setGps] = useState<{ signal: GpsSignal; message: string | null }>({ signal: "idle", message: null });
  const [live, setLive] = useState<LiveTrip>(EMPTY_LIVE);
  const [record, setRecord] = useState<TripRecord | null>(null);
  const [verify, setVerify] = useState<VerifyState>(INITIAL_VERIFY);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Mutable mirrors so timers / geolocation callbacks never read stale state.
  const statusRef = useRef<TripStatus>("IDLE");
  const setupRef = useRef(setup);
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
      setupRef.current = s;
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
    const w = walletRef.current;
    const durationSec = s.source === "gps" ? l.activeMs / 1000 : l.simSec;
    const samples = l.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const rec: TripRecord = {
      id: l.tripId,
      status: "COMPLETED",
      source: s.source,
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
      salt: Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join(""),
      vehicle: {
        maskedReg: reg.vehicle.maskedReg,
        category: reg.vehicle.category,
        fuel: reg.vehicle.fuel,
        manufacturer: reg.vehicle.manufacturer,
        model: reg.vehicle.model,
      },
      wallet: {
        address: w.address ?? reg.wallet.address,
        chainId: w.chainId ?? reg.wallet.chainId,
        mode: w.isConnected ? (w.isDemo ? "demo" : "browser") : reg.wallet.mode,
      },
      userId: reg.userId,
      verification: null,
      emissions: null,
      ledger: { phase: "not-submitted" },
      path: downsample(samples.map((p) => ({ lat: p.lat, lng: p.lng })), 160),
    };
    recordRef.current = rec;
    setRecord(rec);
  }, [fire]);

  const persist = useCallback((rec: TripRecord) => {
    const others = historyRef.current.filter((r) => r.id !== rec.id);
    historyStore.set([persistable(rec), ...others].slice(0, 20));
  }, []);

  const verifyTrip = useCallback(async () => {
    const rec = recordRef.current;
    if (!rec || !fire("VERIFY")) return;
    const token = ++runRef.current;
    const ctx: VerifyContext = {
      tripId: rec.id,
      source: rec.source,
      scenario: rec.scenario,
      route: rec.routeId ? getRoute(rec.routeId) : null,
      samples: liveRef.current.samples,
      distanceKm: rec.distanceKm,
      durationSec: rec.durationSec,
      vehicle: { category: rec.vehicle.category, fuel: rec.vehicle.fuel },
      registration: registrationRef.current,
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

    const ok = trust.assigned;
    let emissions = null;
    if (ok) {
      const today = new Date(rec.endedAt).toDateString();
      const tokensAlreadyToday = historyRef.current
        .filter((h) => h.id !== rec.id && h.status === "VERIFIED" && new Date(h.endedAt).toDateString() === today)
        .reduce((n, h) => n + (h.emissions?.tokens ?? 0), 0);
      emissions = calculateEmissions({
        distanceKm: rec.distanceKm,
        category: rec.vehicle.category,
        fuel: rec.vehicle.fuel,
        model: rec.vehicle.model,
        tier: trust.tier,
        tokensAlreadyToday,
        isDemo: trust.isDemo,
      });
    }
    const final: TripRecord = {
      ...rec,
      status: ok ? "VERIFIED" : "FAILED",
      verification: { checks, trust },
      emissions,
    };
    recordRef.current = final;
    setRecord(final);
    fire(ok ? "PASS" : "FAIL");
    persist(final);
  }, [fire, persist]);

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

  const previewLedger = useCallback(async () => {
    const rec = recordRef.current;
    if (!rec?.emissions || !rec.verification?.trust.assigned) return;
    const vehicleId = rec.emissions.contractVehicleId;
    let next: TripRecord;
    if (vehicleId === null) {
      next = {
        ...rec,
        ledger: {
          phase: "not-submitted",
          unavailableReason: "MissionEVRewards has no vehicle class for this vehicle, so no submitTrip call can be prepared.",
        },
      };
    } else {
      const preview = await buildLedgerPreview({ record: rec, samples: liveRef.current.samples, userAddress: rec.wallet.address, vehicleId });
      next = { ...rec, ledger: { phase: "previewed", preview } };
    }
    recordRef.current = next;
    setRecord(next);
    persist(next);
  }, [persist]);

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
        const speed = simSpeedKmh(reg.vehicle.category, seed, l.routeProgressKm, route.lengthKm);
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
      previewLedger,
    }),
    [status, setup, setSetup, gps, live, record, verify, notice, history, start, pause, resume, stop, verifyTrip, reset, clearHistory, previewLedger],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used inside <TripProvider>");
  return ctx;
}
