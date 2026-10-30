import type { FuelType, VehicleCategory } from "@/lib/vehicle";
import type { ContractTier, EmissionResult } from "./types";

/**
 * Emission factors and reward rules.
 *
 * Defaults mirror MissionEVRewards.sol (see repo docs/CARBON_METHOD.md) so the numbers here
 * match what the contract's `previewTrip` would return with its default constants. The contract
 * itself marks several values as DEMO ("replace with ARAI / CEA / DMRC figures") — treat them as
 * placeholders. Everything is configurable via this single object.
 *
 * Reward points are NOT certified carbon credits.
 */
export const EMISSION_CONFIG = {
  petrolGPerLitre: 2310,
  dieselGPerLitre: 2680,
  /** India grid factor, g CO₂ per kWh (contract default; demo value). */
  gridGPerKwh: 710,
  /** Baseline: average petrol bike, mg CO₂/km (46.2 g/km ≈ 50 km/l). */
  baselineMgPerKm: 46200,
  gramsPerToken: 10,
  dailyTokenCap: 200,
  trustPercent: { Rejected: 0, Bronze: 40, Silver: 75, Gold: 100 } as Record<ContractTier, number>,
  /** NOT in the contract — illustrative fallback used only for vehicles without a contract class. */
  cngGPerKg: 2750,
} as const;

export const TRUST_INDEX: Record<ContractTier, number> = { Rejected: 0, Bronze: 1, Silver: 2, Gold: 3 };

interface Profile {
  contractId: number | null;
  mapping: "exact" | "none";
  label: string;
  kind: EmissionResult["kind"];
  /** electric: Wh/km · petrol/diesel: km/l × 10 · cng: km/kg × 10 (contract units) */
  efficiency: number;
  basis: string;
}

export function profileFor(category: VehicleCategory, fuel: FuelType, model: string): Profile {
  const exact = (id: number, label: string, kind: Profile["kind"], efficiency: number, basis: string): Profile => ({
    contractId: id,
    mapping: "exact",
    label,
    kind,
    efficiency,
    basis,
  });
  const none = (label: string, kind: Profile["kind"], efficiency: number, basis: string): Profile => ({
    contractId: null,
    mapping: "none",
    label,
    kind,
    efficiency,
    basis,
  });

  if (category === "Electric two-wheeler") return exact(1, "Ather 450X class (e-scooter)", "electric", 30, "30 Wh/km × grid factor");
  if (category === "Electric car") return exact(2, "Tata Nexon EV class (e-car)", "electric", 140, "140 Wh/km × grid factor");
  if (category === "Two-wheeler" && fuel === "Petrol") {
    return /activa/i.test(model)
      ? exact(4, "Honda Activa class (petrol scooter)", "petrol", 450, "45 km/l")
      : exact(3, "Hero Splendor class (petrol bike)", "petrol", 500, "50 km/l");
  }
  if (category === "Four-wheeler" && fuel === "Petrol") return exact(5, "Maruti Swift class (petrol car)", "petrol", 180, "18 km/l");
  if (category === "Four-wheeler" && fuel === "Diesel") return exact(6, "Diesel SUV class", "diesel", 150, "15 km/l");

  // Not representable in the deployed contract's catalogue → illustrative off-contract fallbacks.
  if (category === "Commercial") {
    if (fuel === "Electric") return none("Commercial EV (fallback)", "electric", 450, "450 Wh/km × grid factor");
    if (fuel === "Diesel") return none("Commercial diesel (fallback)", "diesel", 80, "8 km/l");
    if (fuel === "CNG") return none("Commercial CNG (fallback)", "cng", 80, "8 km/kg");
    if (fuel === "Hybrid") return none("Commercial hybrid (fallback)", "petrol", 90, "9 km/l");
    return none("Commercial petrol (fallback)", "petrol", 100, "10 km/l");
  }
  if (fuel === "CNG") return none(`${category} CNG (fallback)`, "cng", 220, "22 km/kg");
  if (fuel === "Hybrid") return none(`${category} hybrid (fallback)`, "petrol", 220, "22 km/l");
  if (fuel === "Diesel") return none(`${category} diesel (fallback)`, "diesel", 150, "15 km/l");
  if (fuel === "Electric") return none(`${category} electric (fallback)`, "electric", 140, "140 Wh/km × grid factor");
  return none(`${category} petrol (fallback)`, "petrol", 450, "45 km/l");
}

/** Integer arithmetic mirrors the contract (mg/km, floor division) so results can be compared 1:1. */
export function calculateEmissions(input: {
  distanceKm: number;
  category: VehicleCategory;
  fuel: FuelType;
  model: string;
  tier: ContractTier;
  tokensAlreadyToday: number;
  isDemo: boolean;
}): EmissionResult {
  const c = EMISSION_CONFIG;
  const p = profileFor(input.category, input.fuel, input.model);
  const distanceMeters = Math.round(input.distanceKm * 1000);

  let actualMgPerKm: number;
  let tailpipeMgPerKm = 0;
  let generationMgPerKm = 0;
  let energyUsed: number;
  let energyUnit: EmissionResult["energyUnit"];

  if (p.kind === "electric") {
    // Wh/km × g/kWh = mg/km. Tailpipe is zero; the emissions happen at the power station.
    generationMgPerKm = p.efficiency * c.gridGPerKwh;
    actualMgPerKm = generationMgPerKm;
    energyUsed = (input.distanceKm * p.efficiency) / 1000;
    energyUnit = "kWh";
  } else {
    const gPer = p.kind === "petrol" ? c.petrolGPerLitre : p.kind === "diesel" ? c.dieselGPerLitre : c.cngGPerKg;
    tailpipeMgPerKm = Math.floor((gPer * 10_000) / p.efficiency);
    actualMgPerKm = tailpipeMgPerKm;
    energyUsed = input.distanceKm / (p.efficiency / 10);
    energyUnit = p.kind === "cng" ? "kg" : "L";
  }

  const toG = (mgPerKm: number) => (mgPerKm * distanceMeters) / 1_000_000;
  const estimatedG = toG(actualMgPerKm);
  const baselineG = toG(c.baselineMgPerKm);
  const savedG =
    actualMgPerKm < c.baselineMgPerKm ? Math.floor(((c.baselineMgPerKm - actualMgPerKm) * distanceMeters) / 1_000_000) : 0;

  const trustPercent = c.trustPercent[input.tier];
  const tokensBeforeTrust = Math.floor(savedG / c.gramsPerToken);
  const tokensAfterTrust = Math.floor((tokensBeforeTrust * trustPercent) / 100);
  const capRemaining = Math.max(0, c.dailyTokenCap - input.tokensAlreadyToday);
  const tokens = Math.min(tokensAfterTrust, capRemaining);

  return {
    distanceKm: input.distanceKm,
    distanceMeters,
    modeLabel: input.category,
    vehicleClass: p.label,
    contractVehicleId: p.contractId,
    mapping: p.mapping,
    kind: p.kind,
    basis: p.basis,
    energyUsed,
    energyUnit,
    factorGPerKm: actualMgPerKm / 1000,
    tailpipeG: toG(tailpipeMgPerKm),
    generationG: toG(generationMgPerKm),
    estimatedG,
    baselineGPerKm: c.baselineMgPerKm / 1000,
    baselineG,
    differenceG: baselineG - estimatedG,
    savedG,
    tokensBeforeTrust,
    trustPercent,
    tokensAfterTrust,
    dailyCap: c.dailyTokenCap,
    capRemaining,
    tokens,
    isDemo: input.isDemo,
  };
}
