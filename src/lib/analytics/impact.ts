import { calculateEmissions, EMISSION_CONFIG } from "@/lib/trip/emissions";
import type { ContractTier } from "@/lib/trip/types";
import type { FuelType, VehicleCategory } from "@/lib/vehicle";
import { TRANSIT_MG_PER_KM, type ModeId } from "./modes";

export type VehicleVariant = "ev-scooter" | "ev-car" | "petrol-bike" | "petrol-scooter" | "petrol-car" | "diesel-suv";

const VARIANTS: Record<VehicleVariant, { category: VehicleCategory; fuel: FuelType; model: string }> = {
  "ev-scooter": { category: "Electric two-wheeler", fuel: "Electric", model: "Ather 450X" },
  "ev-car": { category: "Electric car", fuel: "Electric", model: "Nexon EV" },
  "petrol-bike": { category: "Two-wheeler", fuel: "Petrol", model: "Splendor" },
  "petrol-scooter": { category: "Two-wheeler", fuel: "Petrol", model: "Activa" },
  "petrol-car": { category: "Four-wheeler", fuel: "Petrol", model: "Swift" },
  "diesel-suv": { category: "Four-wheeler", fuel: "Diesel", model: "Scorpio" },
};

export interface Impact {
  baselineG: number;
  actualG: number;
  /** Journey Lab rule: only when below baseline, floored to whole grams. */
  avoidedG: number;
  tokens: number;
}

/**
 * Per-journey impact for the demo community. Vehicles the contract knows go through the exact same
 * `calculateEmissions` that Screen 02 uses (so the maths cannot drift); transit / walking use the
 * illustrative per-passenger-km factors but the same baseline + "only below baseline" saving rule.
 */
export function journeyImpact(input: { mode: ModeId; variant?: VehicleVariant; distanceKm: number; tier: ContractTier; tokensAlreadyToday: number }): Impact {
  if (input.mode === "metro" || input.mode === "ebus" || input.mode === "active") {
    const mg = TRANSIT_MG_PER_KM[input.mode];
    const meters = Math.round(input.distanceKm * 1000);
    const toG = (perKm: number) => (perKm * meters) / 1_000_000;
    const base = EMISSION_CONFIG.baselineMgPerKm;
    return {
      baselineG: toG(base),
      actualG: toG(mg),
      avoidedG: mg < base ? Math.floor(((base - mg) * meters) / 1_000_000) : 0,
      // The deployed contract has no class for these modes, so nothing could be minted today.
      tokens: 0,
    };
  }
  const v = VARIANTS[input.variant ?? (input.mode === "ev" ? "ev-scooter" : input.mode === "diesel" ? "diesel-suv" : "petrol-bike")];
  const e = calculateEmissions({
    distanceKm: input.distanceKm,
    category: v.category,
    fuel: v.fuel,
    model: v.model,
    tier: input.tier,
    tokensAlreadyToday: input.tokensAlreadyToday,
    isDemo: true,
  });
  return { baselineG: e.baselineG, actualG: e.estimatedG, avoidedG: e.savedG, tokens: e.tokens };
}
