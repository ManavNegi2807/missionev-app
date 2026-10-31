import { fnv1a } from "@/lib/format";
import { validateConsumption, validateMileage } from "@/lib/carbon/efficiency";
import { haversineKm, projectOnPolyline, type LatLng } from "./geo";
import type { DemoRoute } from "./demo-routes";
import { speedClassOf, TRAVEL_LABEL, type SpeedClass } from "./travel";
import type { CheckItem, CheckResult, CheckStatus, ContractTier, GpsSample, RideHailInfo, Scenario, TravelMode, TripSource, TripVehicle, TrustResult } from "./types";

/**
 * Trip verification. These are pure functions of the trip evidence, so the browser runs them for instant feedback and
 * the oracle route runs the same code again on the evidence it receives: the server never trusts a client's verdict.
 */
export interface VerifyContext {
  tripId: string;
  source: TripSource;
  scenario: Scenario;
  mode: TravelMode;
  route: DemoRoute | null;
  samples: GpsSample[];
  distanceKm: number;
  durationSec: number;
  /** The vehicle used on this trip; null for metro, bus and walking. */
  vehicle: TripVehicle | null;
  rideHail: RideHailInfo | null;
  /** Fingerprints of earlier trips in this session (replay detection). */
  knownFingerprints: Array<{ id: string; fingerprint: string }>;
}

const SPEED_LIMIT: Record<SpeedClass, number> = { car: 140, two_wheeler: 110, metro: 90, ebus: 60, active: 25 };

/** Walking is slower than the 3 km/h floor the vehicle rules use. */
const MIN_AVG_KMH: Partial<Record<SpeedClass, number>> = { active: 2 };
/** Underground metro sections lose GPS for minutes, so the sample-gap rule is looser for it. */
const MAX_GAP_SEC: Partial<Record<SpeedClass, number>> = { metro: 300 };

/** How much evidence backs a tier. Informational: it does not scale the on-chain reward, which the contract fixes. */
export const TRUST_PERCENT: Record<ContractTier, number> = { Rejected: 0, Bronze: 40, Silver: 75, Gold: 100 };

/** Receipt distance and GPS distance must agree this closely for a ride-hail journey to be signed. */
export const RIDE_DISTANCE_TOLERANCE = 0.15;

const stamp = (status: CheckStatus, items: CheckItem[]): CheckStatus => (items.some((i) => i.ok === false) ? "fail" : status);

export function fingerprintOf(samples: GpsSample[]): string {
  let acc = String(samples.length);
  for (const s of samples) acc += `|${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
  return fnv1a(acc).toString(16).padStart(8, "0");
}

const PRIVATE_FUELS: Partial<Record<TravelMode, string[]>> = {
  private_ev_car: ["electric"],
  private_ev_2w: ["electric"],
  private_petrol_car: ["petrol"],
  private_diesel_car: ["diesel"],
  private_ice_2w: ["petrol", "diesel", "cng"],
};

/* ---------------- 3.1 Journey vehicle / ride receipt (self-declared — no registry is contacted) ---------------- */
export function checkVehicle(ctx: VerifyContext): CheckResult {
  if (ctx.mode === "metro" || ctx.mode === "ebus" || ctx.mode === "active") {
    return {
      id: "3.1",
      status: "na",
      isDemo: false,
      summary: `Not applicable: this trip was made by ${TRAVEL_LABEL[ctx.mode].toLowerCase()}, so no vehicle is involved.`,
      items: [{ label: "Vehicle", ok: null, detail: "Not needed for this travel mode" }],
      technical: { reason: "no vehicle", mode: ctx.mode },
      at: null,
    };
  }

  const v = ctx.vehicle;
  const spec = v?.spec;
  const efficiencyError = spec
    ? spec.powertrain === "electric"
      ? validateConsumption(spec.body, spec.consumptionKWhPerKm ?? 0)
      : validateMileage(spec.body, spec.powertrain, spec.mileageKmPerUnit ?? 0)
    : "No vehicle.";
  const items: CheckItem[] = [];

  if (ctx.mode === "ride_hail") {
    const r = ctx.rideHail;
    const receiptKm = r?.receipt.distanceKm ?? null;
    const diff = receiptKm && ctx.distanceKm > 0 ? Math.abs(receiptKm - ctx.distanceKm) / ctx.distanceKm : null;
    items.push(
      { label: "Ride receipt provided", ok: Boolean(r), detail: r ? `${r.provider} · ${r.receipt.source === "ocr-reviewed" ? "read by OCR, reviewed by you" : "entered by you"}` : "Add the receipt or its details." },
      { label: "Vehicle and fuel confirmed by you", ok: Boolean(r?.receipt.confirmedByUser && v), detail: v ? `${v.label} · ${v.spec.powertrain}` : "Confirm the vehicle that carried you." },
      {
        label: `Receipt distance vs captured distance (±${RIDE_DISTANCE_TOLERANCE * 100}%)`,
        ok: diff === null ? false : diff <= RIDE_DISTANCE_TOLERANCE,
        detail: receiptKm ? `${receiptKm.toFixed(1)} km on receipt · ${ctx.distanceKm.toFixed(2)} km captured · Δ ${((diff ?? 0) * 100).toFixed(1)}%` : "The receipt distance is missing.",
      },
      { label: "Efficiency figure plausible", ok: !efficiencyError, detail: efficiencyError ?? "Within the expected range" },
    );
  } else {
    const allowed = PRIVATE_FUELS[ctx.mode] ?? [];
    items.push(
      { label: "Vehicle chosen for this journey", ok: Boolean(v), detail: v ? v.label : "Pick a vehicle from your profile on Screen 01." },
      { label: "Vehicle matches the journey mode", ok: spec ? allowed.includes(spec.powertrain) : false, detail: spec ? `${TRAVEL_LABEL[ctx.mode]} · ${spec.powertrain}` : "—" },
      { label: "Efficiency figure plausible", ok: !efficiencyError, detail: efficiencyError ?? `${spec?.efficiencySource === "category-default" ? "Category default" : "Self-declared"} · within the expected range` },
    );
  }

  const status = stamp("pass", items);
  return {
    id: "3.1",
    status,
    isDemo: false,
    summary:
      status === "fail"
        ? ctx.mode === "ride_hail"
          ? "The ride details don't support a calculation yet."
          : "The vehicle for this journey isn't usable."
        : ctx.mode === "ride_hail"
          ? "The receipt details are consistent. OCR and your confirmation are not proof of the vehicle's fuel; no ride-hail company was contacted."
          : "The journey's vehicle is consistent. The profile is self-declared; no vehicle registry was checked.",
    items,
    technical: { source: ctx.mode === "ride_hail" ? "ride receipt" : "self-declared profile", vehicle: v?.label ?? "—", efficiencySource: spec?.efficiencySource ?? "—" },
    at: null,
  };
}

/* ---------------- 3.2 EV-maker ride log (mock) ---------------- */
export function checkRideLog(ctx: VerifyContext): CheckResult {
  const isEv = (ctx.mode === "private_ev_car" || ctx.mode === "private_ev_2w") && ctx.vehicle?.spec.powertrain === "electric";
  if (!isEv) {
    return {
      id: "3.2",
      status: "na",
      isDemo: false,
      summary: ctx.mode === "ride_hail" ? "Not applicable: a ride-hail journey is checked against its receipt instead." : "Not applicable: only a private EV has an EV-maker ride log to compare.",
      items: [{ label: "EV ride-log availability", ok: null, detail: `${TRAVEL_LABEL[ctx.mode]} trip` }],
      technical: { reason: "no private EV" },
      at: null,
    };
  }
  const h = fnv1a(`${ctx.tripId}:ridelog`);
  const factor = ctx.scenario === "ridelog-mismatch" ? 0.55 : 0.985 + (h % 31) / 1000; // 0.985–1.015
  const reported = ctx.distanceKm * factor;
  const diffPct = ctx.distanceKm > 0 ? (Math.abs(reported - ctx.distanceKm) / ctx.distanceKm) * 100 : 100;
  const items: CheckItem[] = [
    { label: "EV ride-log available", ok: true, detail: "Mock log generated locally" },
    { label: "Vehicle identity consistent", ok: true, detail: ctx.vehicle?.label ?? "—" },
    {
      label: "Reported distance vs trip distance (±5%)",
      ok: diffPct <= 5,
      detail: `${reported.toFixed(2)} km reported · ${ctx.distanceKm.toFixed(2)} km captured · Δ ${diffPct.toFixed(1)}%`,
    },
  ];
  const status = stamp("demo", items);
  return {
    id: "3.2",
    status,
    isDemo: true,
    summary:
      status === "fail"
        ? "The ride log's distance disagrees with the captured trip."
        : "Mock ride log agrees with the captured distance. No EV-maker API was called.",
    items,
    technical: { adapter: "mock-ev-maker (local)", reportedKm: Number(reported.toFixed(3)), tolerancePct: 5 },
    at: null,
  };
}

/* ---------------- 3.3 Motion & GPS (D2 Trips & Telemetry) ---------------- */
export function checkMotion(ctx: VerifyContext): CheckResult {
  const s = ctx.samples;
  const speedClass = speedClassOf(ctx.mode, ctx.vehicle?.spec.body);
  const limit = SPEED_LIMIT[speedClass];
  const minAvg = MIN_AVG_KMH[speedClass] ?? 3;
  const gapLimit = MAX_GAP_SEC[speedClass] ?? 120;
  let maxGapSec = 0;
  let dupTs = 0;
  let teleports = 0;
  let moving = 0;
  let segs = 0;
  for (let i = 1; i < s.length; i++) {
    const dtSec = (s[i].t - s[i - 1].t) / 1000;
    if (dtSec <= 0) {
      dupTs++;
      continue;
    }
    maxGapSec = Math.max(maxGapSec, dtSec);
    const v = (haversineKm(s[i - 1], s[i]) / dtSec) * 3600;
    segs++;
    if (v > 1) moving++;
    if (v > limit * 1.5) teleports++;
  }
  const dupShare = s.length > 1 ? dupTs / (s.length - 1) : 0;
  const movingShare = segs ? moving / segs : 0;
  const avg = ctx.durationSec > 0 ? ctx.distanceKm / (ctx.durationSec / 3600) : 0;
  const fp = fingerprintOf(s);
  const match = ctx.knownFingerprints.find((k) => k.fingerprint === fp);

  const items: CheckItem[] = [
    {
      label: "Location sample completeness",
      ok: s.length >= 5 && maxGapSec <= gapLimit,
      detail: `${s.length} samples · largest gap ${Math.round(maxGapSec)} s (need ≥ 5 samples, gaps ≤ ${gapLimit} s)`,
    },
    {
      label: "Movement consistency",
      ok: teleports === 0 && movingShare >= 0.5,
      detail: `${Math.round(movingShare * 100)}% of segments moving · ${teleports} impossible jump(s) (> ${Math.round(limit * 1.5)} km/h)`,
    },
    {
      label: "Distance plausibility",
      ok: ctx.distanceKm >= 0.2 && avg >= minAvg && avg <= limit,
      detail: `${ctx.distanceKm.toFixed(2)} km at ${avg.toFixed(1)} km/h average (class limit ${limit} km/h)`,
    },
    {
      label: "Duplicate / replay indication",
      ok: dupShare <= 0.02 && !match,
      detail: match
        ? `Sample fingerprint matches earlier trip ${match.id}`
        : `${(dupShare * 100).toFixed(1)}% duplicate timestamps · no fingerprint match in session history`,
    },
  ];
  const status = stamp(ctx.source === "gps" ? "pass" : "demo", items);
  const failed = items.filter((i) => i.ok === false).length;
  return {
    id: "3.3",
    status,
    isDemo: ctx.source === "simulated",
    summary:
      status === "fail"
        ? `${failed} of 4 motion rules failed on the captured samples.`
        : ctx.source === "gps"
          ? "Captured GPS samples satisfy the prototype's local motion rules."
          : "Simulated samples satisfy the local rules (DEMO — not real GPS).",
    items,
    technical: {
      store: "D2 · frontend state",
      samples: s.length,
      maxGapSec: Math.round(maxGapSec),
      duplicateTimestampPct: Number((dupShare * 100).toFixed(2)),
      fingerprint: fp,
    },
    at: null,
  };
}

/* ---------------- 3.4 Route validation (Azure Maps — routing NOT integrated) ---------------- */
export function checkRoute(ctx: VerifyContext): CheckResult {
  const s = ctx.samples;
  const first: LatLng | undefined = s[0];
  const last: LatLng | undefined = s[s.length - 1];
  const valid = (p?: LatLng) => !!p && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);
  const straightKm = first && last ? haversineKm(first, last) : 0;

  const items: CheckItem[] = [
    {
      label: "Start and end coordinates",
      ok: valid(first) && valid(last) && straightKm >= 0.1,
      detail:
        first && last
          ? `${first.lat.toFixed(3)}, ${first.lng.toFixed(3)} → ${last.lat.toFixed(3)}, ${last.lng.toFixed(3)} · ${straightKm.toFixed(2)} km apart`
          : "No samples",
    },
  ];

  let maxDevM = 0;
  let deviating = 0;
  let expectedKm: number | null = null;
  if (ctx.route && s.length) {
    for (const p of s) {
      const proj = projectOnPolyline(p, ctx.route.points, ctx.route.cum);
      maxDevM = Math.max(maxDevM, proj.distM);
      if (proj.distM > 60) deviating++;
    }
    expectedKm = last ? projectOnPolyline(last, ctx.route.points, ctx.route.cum).alongKm : null;
    items.push({
      label: "Route consistency",
      ok: deviating === 0,
      detail: `Max ${Math.round(maxDevM)} m from the planned route · ${deviating} sample(s) beyond 60 m`,
    });
    const diff = expectedKm && expectedKm > 0 ? (Math.abs(ctx.distanceKm - expectedKm) / expectedKm) * 100 : 100;
    items.push({
      label: "Calculated distance comparison (±5%)",
      ok: expectedKm !== null && diff <= 5,
      detail: `Captured ${ctx.distanceKm.toFixed(2)} km · along planned route ${expectedKm?.toFixed(2) ?? "—"} km · Δ ${diff.toFixed(1)}%`,
    });
    items.push({
      label: "Route anomalies",
      ok: deviating === 0,
      detail: deviating === 0 ? "None detected" : `${deviating} off-route samples`,
    });
  } else {
    const circuity = straightKm > 0 ? ctx.distanceKm / straightKm : Infinity;
    items.push({
      label: "Route consistency",
      ok: null,
      detail: "No planned route — Azure Maps routing isn't configured, so road-following wasn't checked.",
    });
    items.push({
      label: "Calculated distance comparison",
      ok: null,
      detail: "Routed distance unavailable (no routing service).",
    });
    items.push({
      label: "Route anomalies",
      ok: circuity <= 4,
      detail: `Path is ${Number.isFinite(circuity) ? circuity.toFixed(2) : "∞"}× the straight-line distance (limit 4×)`,
    });
  }

  const status = stamp("demo", items);
  return {
    id: "3.4",
    status,
    isDemo: true,
    summary:
      status === "fail"
        ? "The captured path disagrees with the expected route."
        : ctx.route
          ? "Path follows the planned demo route (local geometry; Azure Maps routing not called)."
          : "Basic geometry looks sane. Road-following needs Azure Maps routing, which isn't integrated.",
    items,
    technical: {
      engine: "local geometry (not Azure Maps routing)",
      maxDeviationM: Math.round(maxDevM),
      straightLineKm: Number(straightKm.toFixed(3)),
    },
    at: null,
  };
}

/* ---------------- 3.5 Assign trust level ---------------- */
export function assignTrust(results: Record<"3.1" | "3.2" | "3.3" | "3.4", CheckResult>): TrustResult {
  const titles: Record<string, string> = {
    "3.1": "Journey vehicle / receipt check",
    "3.2": "EV maker ride-log check",
    "3.3": "Motion & GPS validation",
    "3.4": "Route validation",
  };
  const failed = (Object.values(results) as CheckResult[]).filter((r) => r.status === "fail").map((r) => `${r.id} ${titles[r.id]}`);
  const incomplete = (Object.values(results) as CheckResult[]).some((r) => r.status === "pending" || r.status === "running");
  const assigned = failed.length === 0 && !incomplete;
  const partnerProof = results["3.2"].status === "pass" || results["3.2"].status === "demo";
  // Decision table (docs/VERIFICATION.md): all proofs → Gold; no partner log → Silver; any failure → Rejected.
  const tier: ContractTier = !assigned ? "Rejected" : partnerProof ? "Gold" : "Silver";
  const isDemo = (Object.values(results) as CheckResult[]).some((r) => r.isDemo);
  return {
    assigned,
    level: assigned ? 4.0 : null,
    tier,
    tierPercent: TRUST_PERCENT[tier],
    isDemo,
    failedConditions: failed,
    at: Date.now(),
  };
}
