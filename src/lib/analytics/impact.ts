import { calculateJourney } from "@/lib/carbon/emissionsEngine";
import { previewReward } from "@/lib/carbon/rewardPreview";
import type { JourneyMode, VehicleEnergySpec } from "@/lib/carbon/types";
import type { ModeId } from "./modes";

export type VehicleVariant = "ev-scooter" | "ev-car" | "petrol-bike" | "petrol-scooter" | "petrol-car" | "diesel-suv";

const spec = (s: Omit<VehicleEnergySpec, "efficiencySource" | "confidence">): VehicleEnergySpec => ({ ...s, efficiencySource: "category-default", confidence: "low" });

/** The demo community's vehicles: illustrative, so each is a labelled category-level spec, not a real model's figures. */
const VARIANTS: Record<VehicleVariant, { mode: JourneyMode; vehicle: VehicleEnergySpec }> = {
  "ev-scooter": { mode: "private_ev_2w", vehicle: spec({ body: "two_wheeler", powertrain: "electric", consumptionKWhPerKm: 0.03, consumptionBasis: "battery" }) },
  "ev-car": { mode: "private_ev_car", vehicle: spec({ body: "car", powertrain: "electric", consumptionKWhPerKm: 0.14, consumptionBasis: "battery" }) },
  "petrol-bike": { mode: "private_ice_2w", vehicle: spec({ body: "two_wheeler", powertrain: "petrol", mileageKmPerUnit: 50 }) },
  "petrol-scooter": { mode: "private_ice_2w", vehicle: spec({ body: "two_wheeler", powertrain: "petrol", mileageKmPerUnit: 45 }) },
  "petrol-car": { mode: "private_petrol_car", vehicle: spec({ body: "car", powertrain: "petrol", mileageKmPerUnit: 18 }) },
  "diesel-suv": { mode: "private_diesel_car", vehicle: spec({ body: "car", powertrain: "diesel", mileageKmPerUnit: 15, isSuv: true }) },
};

export interface Impact {
  baselineG: number;
  actualG: number;
  /** Whole grams below the reference journey (0 when above it). */
  avoidedG: number;
  /** Whole $MEV the contract would mint for a first-day trip (streak multiplier 1×). 0 when the journey isn't rewarded. */
  tokens: number;
}

/**
 * Per-journey impact for the demo community. Every mode goes through the same `calculateJourney` the Capture Trip screen
 * uses, so the maths, the reference journey and the "only cleaner modes are rewarded" policy cannot drift between screens.
 * The community's streaks aren't modelled, so rewards use the contract's 1× multiplier.
 */
export function journeyImpact(input: { mode: ModeId; variant?: VehicleVariant; distanceKm: number }): Impact {
  const v = input.mode === "metro" || input.mode === "ebus" || input.mode === "active" ? null : VARIANTS[input.variant ?? (input.mode === "ev" ? "ev-scooter" : input.mode === "diesel" ? "diesel-suv" : "petrol-bike")];
  const r = calculateJourney({ mode: v ? v.mode : (input.mode as JourneyMode), vehicle: v?.vehicle, distanceKm: input.distanceKm });
  const tokens =
    r.reward.eligible && r.contract.mode !== null
      ? Number(previewReward({ commuter: { streakDays: 0, lastTripTimestamp: 0 }, mode: r.contract.mode, co2AvoidedGrams: r.co2AvoidedGrams, nowSec: 0 }).rewardWei / BigInt("1000000000000000000"))
      : 0;
  return { baselineG: r.baseline.grams, actualG: r.actual.grams, avoidedG: r.co2AvoidedGrams, tokens };
}
