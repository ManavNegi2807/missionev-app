import { calculateJourney } from "@/lib/carbon/emissionsEngine";
import { previewReward } from "@/lib/carbon/rewardPreview";
import type { JourneyMode, VehicleEnergySpec } from "@/lib/carbon/types";

/**
 * The landing page's "try the maths" widget runs the SAME engine and reward formula as the app, over a few sample journeys.
 * The trip date is fixed so the page is deterministic (and prerenderable): it selects the FY 2025-26 grid factor.
 */
const TRIP_AT = Date.UTC(2026, 10, 4, 6, 0, 0);
const TRIP_SEC = Math.floor(TRIP_AT / 1000);
const DAY = 86400;

export type SampleModeId = "metro" | "ebus" | "active" | "ev_car" | "petrol_car";

interface SampleMode {
  id: SampleModeId;
  label: string;
  journey: JourneyMode;
  /** Illustrative vehicle; the real app uses the commuter's own saved vehicle. */
  vehicle?: VehicleEnergySpec;
}

const SAMPLE_EV: VehicleEnergySpec = {
  body: "car",
  powertrain: "electric",
  consumptionKWhPerKm: 40.5 / 325,
  consumptionBasis: "battery",
  efficiencySource: "user-range-battery",
  confidence: "medium",
  label: "Sample EV (40.5 kWh battery, 325 km range)",
};

const SAMPLE_PETROL: VehicleEnergySpec = {
  body: "car",
  powertrain: "petrol",
  mileageKmPerUnit: 18,
  efficiencySource: "user-entered",
  confidence: "medium",
  label: "Sample petrol car (18 km/l)",
};

export const SAMPLE_MODES: readonly SampleMode[] = [
  { id: "metro", label: "Metro", journey: "metro" },
  { id: "ebus", label: "Electric bus", journey: "ebus" },
  { id: "active", label: "Walk or cycle", journey: "active" },
  { id: "ev_car", label: "Electric car", journey: "private_ev_car", vehicle: SAMPLE_EV },
  { id: "petrol_car", label: "Petrol car", journey: "private_petrol_car", vehicle: SAMPLE_PETROL },
];

/** Streak days the widget offers; the contract's multipliers step up at 5, 10 and 20 days. */
export const STREAK_STEPS = [1, 5, 10, 20] as const;

export const MIN_KM = 1;
export const MAX_KM = 40;

export interface SampleResult {
  mode: SampleModeId;
  km: number;
  actualGrams: number;
  referenceGrams: number;
  /** What the journey is compared with, as the engine names it (e.g. "average petrol two-wheeler"). */
  referenceLabel: string;
  avoidedGrams: number;
  eligible: boolean;
  /** Why nothing is rewarded; empty when eligible. */
  reason: string;
  streakDay: number;
  multiplier: number;
  modeBonusMev: number;
  /** $MEV this journey would mint: 0 when the policy refuses to sign it. */
  mev: number;
  formula: string;
}

export function sampleJourney(id: SampleModeId, km: number, streakDay: number): SampleResult {
  const mode = SAMPLE_MODES.find((m) => m.id === id) ?? SAMPLE_MODES[0];
  const distanceKm = Math.min(MAX_KM, Math.max(MIN_KM, Number.isFinite(km) ? km : MIN_KM));
  const day = Math.max(1, Math.floor(streakDay));

  const result = calculateJourney({ mode: mode.journey, distanceKm, vehicle: mode.vehicle, at: TRIP_AT });
  // "Day N of a streak" means yesterday was day N-1, so the contract's streak update lands on N.
  const commuter = day > 1 ? { streakDays: day - 1, lastTripTimestamp: TRIP_SEC - DAY } : { streakDays: 0, lastTripTimestamp: 0 };
  const preview = previewReward({ commuter, mode: result.contract.mode ?? 0, co2AvoidedGrams: result.co2AvoidedGrams, nowSec: TRIP_SEC });

  const eligible = result.reward.eligible && result.contract.supported;
  return {
    mode: mode.id,
    km: distanceKm,
    actualGrams: result.actual.grams,
    referenceGrams: result.baseline.grams,
    referenceLabel: result.baseline.label,
    avoidedGrams: result.co2AvoidedGrams,
    eligible,
    reason: eligible ? "" : result.reward.reason,
    streakDay: day,
    multiplier: preview.multiplierBps / 10000,
    modeBonusMev: Number(preview.modeBonusWei) / 1e18,
    mev: eligible ? Number(preview.rewardWei) / 1e18 : 0,
    formula: preview.formula,
  };
}
