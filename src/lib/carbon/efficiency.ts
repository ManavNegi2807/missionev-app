import { CATEGORY_DEFAULTS, EFFICIENCY_BOUNDS } from "./emissionFactors";
import type { Confidence, ConsumptionBasis, EfficiencySource, Powertrain, VehicleBody, VehicleEnergySpec } from "./types";

/** Vehicle-efficiency derivations. Pure functions: the forms show these results, they never re-implement them. */

export interface EvConsumption {
  kWhPerKm: number;
  kWhPer100Km: number;
  kmPerKWh: number;
  /** The formula as text, with the inputs substituted. */
  formula: string;
}

/** Rounds away float noise (0.14 × 100 = 14.000000000000002) so a figure the commuter typed comes back exactly as typed. */
const clean = (n: number) => Math.round(n * 1e9) / 1e9;

const view = (kWhPerKm: number, formula: string): EvConsumption => ({
  kWhPerKm,
  kWhPer100Km: clean(kWhPerKm * 100),
  kmPerKWh: clean(1 / kWhPerKm),
  formula,
});

/** consumption = usable battery capacity ÷ full-charge range. Battery-side, and only as good as the range you give it. */
export function evConsumptionFromRange(usableBatteryKWh: number, rangeKm: number): EvConsumption {
  assertPositive(usableBatteryKWh, "usable battery capacity");
  assertPositive(rangeKm, "range");
  const c = usableBatteryKWh / rangeKm;
  return view(c, `${trim(usableBatteryKWh)} kWh ÷ ${trim(rangeKm)} km = ${c.toFixed(4)} kWh/km`);
}

export function evConsumptionFromPer100Km(kWhPer100Km: number): EvConsumption {
  assertPositive(kWhPer100Km, "consumption");
  const c = kWhPer100Km / 100;
  return view(c, `${trim(kWhPer100Km)} kWh/100 km ÷ 100 = ${c.toFixed(4)} kWh/km`);
}

export function evConsumptionFromKmPerKWh(kmPerKWh: number): EvConsumption {
  assertPositive(kmPerKWh, "efficiency");
  const c = 1 / kmPerKWh;
  return view(c, `1 ÷ ${trim(kmPerKWh)} km/kWh = ${c.toFixed(4)} kWh/km`);
}

function assertPositive(n: number, what: string) {
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(`${what} must be a positive number.`);
}
const trim = (n: number) => String(Math.round(n * 1000) / 1000);

/** Confidence in a vehicle's own efficiency figure, from where it came from. */
export const confidenceOf = (source: EfficiencySource, catalogConfidence?: Confidence): Confidence => {
  switch (source) {
    case "category-default":
      return "low";
    case "catalog":
      return catalogConfidence ?? "medium";
    default:
      return "medium"; // self-declared; rated range and dashboard figures differ from real-world use
  }
};

export const EFFICIENCY_SOURCE_LABEL: Record<EfficiencySource, string> = {
  "user-entered": "entered by you",
  "user-range-battery": "calculated from your battery size and range",
  "user-kwh-per-100km": "entered by you (energy consumption)",
  catalog: "vehicle catalogue",
  "category-default": "category default (not your vehicle's own figure)",
};

/** A labelled category-level default, for commuters who can't give a figure and have no catalogue match. */
export function categoryDefaultSpec(body: VehicleBody, powertrain: Powertrain, extra: Partial<VehicleEnergySpec> = {}): VehicleEnergySpec {
  const base: VehicleEnergySpec = { body, powertrain, efficiencySource: "category-default", confidence: "low", ...extra };
  if (powertrain === "electric") {
    return { ...base, consumptionKWhPerKm: CATEGORY_DEFAULTS.electric[body], consumptionBasis: "battery" as ConsumptionBasis };
  }
  return { ...base, mileageKmPerUnit: CATEGORY_DEFAULTS[powertrain][body] };
}

/* ---------------------------------------------------------------- validation (shared by the forms and the server) */

const within = (n: number, [lo, hi]: readonly [number, number]) => n >= lo && n <= hi;

export function validateMileage(body: VehicleBody, powertrain: Powertrain, n: number): string | undefined {
  if (!Number.isFinite(n) || n <= 0) return "Mileage must be a positive number.";
  if (powertrain === "electric") return "Electric vehicles use kWh, not km/l.";
  const unit = powertrain === "cng" ? "km/kg" : "km/l";
  const range = powertrain === "cng" ? EFFICIENCY_BOUNDS.mileageKmPerKg[body] : EFFICIENCY_BOUNDS.mileageKmPerLitre[body];
  return within(n, range) ? undefined : `Expected ${range[0]}–${range[1]} ${unit} for this vehicle. Check the value.`;
}

export function validateEvInputs(
  body: VehicleBody,
  input: { usableBatteryKWh?: number; rangeKm?: number; kWhPer100Km?: number; kmPerKWh?: number },
): Partial<Record<"usableBatteryKWh" | "rangeKm" | "kWhPer100Km" | "kmPerKWh", string>> {
  const e: Partial<Record<"usableBatteryKWh" | "rangeKm" | "kWhPer100Km" | "kmPerKWh", string>> = {};
  const b = EFFICIENCY_BOUNDS;
  if (input.usableBatteryKWh !== undefined && !(input.usableBatteryKWh > 0 && within(input.usableBatteryKWh, b.usableBatteryKWh[body]))) {
    e.usableBatteryKWh = `Expected ${b.usableBatteryKWh[body][0]}–${b.usableBatteryKWh[body][1]} kWh usable capacity.`;
  }
  if (input.rangeKm !== undefined && !(input.rangeKm > 0 && within(input.rangeKm, b.rangeKm[body]))) {
    e.rangeKm = `Expected ${b.rangeKm[body][0]}–${b.rangeKm[body][1]} km real-world range.`;
  }
  const per100 = b.kWhPerKm[body].map((v) => v * 100) as [number, number];
  if (input.kWhPer100Km !== undefined && !(input.kWhPer100Km > 0 && within(input.kWhPer100Km, per100))) {
    e.kWhPer100Km = `Expected ${per100[0]}–${per100[1]} kWh/100 km.`;
  }
  const kmPerKWh = b.kWhPerKm[body].map((v) => 1 / v).reverse() as [number, number];
  if (input.kmPerKWh !== undefined && !(input.kmPerKWh > 0 && within(input.kmPerKWh, kmPerKWh))) {
    e.kmPerKWh = `Expected ${kmPerKWh[0].toFixed(1)}–${kmPerKWh[1].toFixed(1)} km/kWh.`;
  }
  return e;
}

/** Whether a derived kWh/km is plausible for the body type (a 200 kWh battery with a 50 km range is a typo). */
export function validateConsumption(body: VehicleBody, kWhPerKm: number): string | undefined {
  const [lo, hi] = EFFICIENCY_BOUNDS.kWhPerKm[body];
  return kWhPerKm >= lo && kWhPerKm <= hi
    ? undefined
    : `That works out to ${(kWhPerKm * 100).toFixed(1)} kWh/100 km, outside the expected ${lo * 100}–${hi * 100}. Check the battery size and range.`;
}
