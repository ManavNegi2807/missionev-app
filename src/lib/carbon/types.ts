/**
 * Shared carbon-accounting types.
 *
 * Unit conventions (everything in this folder follows them, nothing else should invent its own):
 *  - distance: kilometres (`distanceKm`); metres only at the contract boundary (`distanceMeters`, integer)
 *  - fuel: litres (petrol, diesel) or kilograms (CNG)
 *  - electricity: kWh; consumption as kWh/km internally (kWh/100 km and km/kWh are derived views)
 *  - emissions: grams CO2e (`…Grams`), integers only at the contract boundary (`co2AvoidedGrams`)
 */

export type Confidence = "high" | "medium" | "low";

/** How trustworthy a factor's provenance is — shown next to every number in the UI. */
export type FactorStatus = "primary" | "secondary" | "assumption";

/**
 * One accounting boundary for the whole MVP, so an EV is never compared with an ICE vehicle on a different basis.
 * "energy-use-direct": CO2 released where the energy is converted — the tailpipe for fuel, the power-station stack for
 * grid electricity. Excludes fuel/electricity upstream (well-to-tank), transmission & distribution losses, and vehicle or
 * battery manufacturing. Battery-production emissions are a separate life-cycle feature, never silently added to a trip.
 */
export type AccountingBoundaryId = "energy-use-direct";

export interface EmissionFactor {
  id: string;
  label: string;
  value: number;
  unit: string;
  boundary: AccountingBoundaryId;
  geography: string;
  /** Reporting year the value applies to (financial year for electricity). */
  year: string;
  version?: string;
  method: string;
  source: string;
  sourceUrl?: string;
  status: FactorStatus;
  confidence: Confidence;
  notes?: string;
}

export type Powertrain = "petrol" | "diesel" | "cng" | "electric";
export type VehicleBody = "car" | "two_wheeler";

/**
 * Transport the commuter actually used for ONE journey. Chosen per trip, never inferred from what they own.
 * ("other" exists only in the registration profile; it can't be a journey.)
 */
export type JourneyMode =
  | "private_ev_car"
  | "private_ev_2w"
  | "private_petrol_car"
  | "private_diesel_car"
  | "private_ice_2w"
  | "ride_hail"
  | "metro"
  | "ebus"
  | "active";

/** Where a vehicle's efficiency figure came from — drives the confidence label. */
export type EfficiencySource = "user-entered" | "user-range-battery" | "user-kwh-per-100km" | "catalog" | "category-default";

/**
 * Basis of an EV's consumption figure. "battery": energy into the wheels as a dashboard reports it (needs a charging-loss
 * gross-up to get electricity drawn from the grid). "wall": energy drawn from the charger/socket (no gross-up).
 */
export type ConsumptionBasis = "battery" | "wall";

/** A vehicle reduced to what the carbon maths needs. Built from the commuter's saved profile (or a confirmed ride receipt). */
export interface VehicleEnergySpec {
  body: VehicleBody;
  powertrain: Powertrain;
  isSuv?: boolean;
  /** km per litre (petrol, diesel) or km per kg (CNG). ICE only. */
  mileageKmPerUnit?: number;
  /** kWh per km on `consumptionBasis`. Electric only. */
  consumptionKWhPerKm?: number;
  consumptionBasis?: ConsumptionBasis;
  efficiencySource: EfficiencySource;
  confidence: Confidence;
  /** Free text shown in the breakdown, e.g. "Tata Nexon EV". */
  label?: string;
}

export interface JourneyInput {
  mode: JourneyMode;
  distanceKm: number;
  /** Required for private_* modes and ride_hail. */
  vehicle?: VehicleEnergySpec;
  /** Ride-hail party size the vehicle's emissions are shared across. Default 1. */
  occupants?: number;
  /** Trip date; selects the electricity-factor year. Default: now. */
  at?: number | Date;
}

export interface EnergyUse {
  kind: "fuel" | "electricity" | "none";
  amount: number;
  /** "L" | "kg" | "kWh" */
  unit: "L" | "kg" | "kWh" | null;
}

export interface EmissionsBreakdown {
  grams: number;
  /** Human-readable formula with the inputs substituted in. */
  formula: string;
  inputs: Record<string, string | number>;
  factorIds: string[];
  energy: EnergyUse;
}

export interface EvEfficiency {
  kWhPerKm: number;
  kWhPer100Km: number;
  kmPerKWh: number;
  basis: ConsumptionBasis;
  reference: { label: string; kWhPer100Km: number; kmPerKWh: number };
  /** Positive = this vehicle uses less electricity per km than the reference. */
  betterThanReferencePct: number;
}

/** Values the existing MissionEV contract can actually record. -1 never appears: unsupported = null. */
export interface ContractModeMapping {
  supported: boolean;
  /** TransportMode numeric value in MissionEV.sol, or null when the contract has no suitable value. */
  mode: number | null;
  modeName: string | null;
  reason?: string;
}

export interface RewardEligibility {
  eligible: boolean;
  reason: string;
}

export interface CarbonResult {
  mode: JourneyMode;
  distanceKm: number;
  /** Integer metres, as the contract takes it. */
  distanceMeters: number;
  actual: EmissionsBreakdown;
  baseline: EmissionsBreakdown & { label: string };
  /** baseline − actual, in grams; negative when the journey emitted more than the reference scenario. */
  rawAvoidedGrams: number;
  /** max(0, floor(rawAvoidedGrams)) — the only avoided figure that can ever be signed or sent on-chain. */
  co2AvoidedGrams: number;
  exceedsReference: boolean;
  evEfficiency: EvEfficiency | null;
  contract: ContractModeMapping;
  reward: RewardEligibility;
  boundary: AccountingBoundaryId;
  boundaryLabel: string;
  reportingYear: string;
  confidence: Confidence;
  assumptions: string[];
  /** Every factor the result used, with source details. */
  factors: EmissionFactor[];
  warnings: string[];
}
