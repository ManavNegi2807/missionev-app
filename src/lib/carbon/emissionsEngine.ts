import { contractModeFor } from "./contractMapping";
import {
  ACTIVE_TRAVEL,
  BOUNDARY,
  BOUNDARY_ID,
  CHARGING_EFFICIENCY,
  EBUS_ENERGY,
  FUEL_FACTORS,
  METRO_ENERGY,
  REFERENCE_EV,
  REFERENCE_VEHICLES,
  UINT32_MAX,
  gridFactorFor,
} from "./emissionFactors";
import { rewardEligibility } from "./rewardPolicy";
import type {
  CarbonResult,
  Confidence,
  EmissionFactor,
  EmissionsBreakdown,
  EvEfficiency,
  JourneyInput,
  JourneyMode,
  VehicleBody,
  VehicleEnergySpec,
} from "./types";

/**
 * The one place emissions are calculated. Screens, the oracle route and the tests all call `calculateJourney`; nothing
 * else in the app multiplies a distance by a factor.
 *
 * Accounting boundary (see BOUNDARY): direct energy-use emissions for every mode — fuel combusted for ICE, grid generation
 * for electricity — so an EV is never compared with an ICE vehicle on a different basis.
 *
 *   ICE:        litres = km ÷ (km/l);           grams = litres × (kgCO2e/L) × 1000
 *   EV:         kWh    = km × kWh/km (÷ 0.9 if battery-side); grams = kWh × (kgCO2/kWh) × 1000
 *   Metro/bus:  grams  = km × kWh per passenger-km × (kgCO2/kWh) × 1000
 *   Reference:  the same ICE formula for a configured reference petrol vehicle over the same distance
 *   Avoided:    max(0, floor(reference − actual))
 */

export class JourneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JourneyInputError";
  }
}

/** Stabilises float noise (10 ÷ 18 × 2232 → 1240.0000000000002) so floor() can't drop a whole gram. */
const g = (x: number) => Math.round(x * 1e6) / 1e6;
const num = (n: number, dp = 2) => {
  const s = n.toFixed(dp);
  return dp > 0 ? s.replace(/\.?0+$/, "") : s;
};

const CONFIDENCE_ORDER: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const lowest = (...c: Confidence[]): Confidence => c.reduce((a, b) => (CONFIDENCE_ORDER[b] < CONFIDENCE_ORDER[a] ? b : a));

const BODY_OF: Record<JourneyMode, VehicleBody | null> = {
  private_ev_car: "car",
  private_ev_2w: "two_wheeler",
  private_petrol_car: "car",
  private_diesel_car: "car",
  private_ice_2w: "two_wheeler",
  ride_hail: null,
  metro: null,
  ebus: null,
  active: null,
};

const REQUIRED_POWERTRAIN: Partial<Record<JourneyMode, VehicleEnergySpec["powertrain"][]>> = {
  private_ev_car: ["electric"],
  private_ev_2w: ["electric"],
  private_petrol_car: ["petrol"],
  private_diesel_car: ["diesel"],
  private_ice_2w: ["petrol", "diesel", "cng"],
};

function checkVehicle(mode: JourneyMode, v: VehicleEnergySpec | undefined): VehicleEnergySpec | undefined {
  const needs = mode === "ride_hail" || BODY_OF[mode] !== null;
  if (!needs) return undefined;
  if (!v) throw new JourneyInputError(mode === "ride_hail" ? "A ride-hail journey needs the confirmed vehicle." : "This journey needs a vehicle from your profile.");
  const body = BODY_OF[mode];
  if (body && v.body !== body) throw new JourneyInputError(`The selected vehicle is a ${v.body.replace("_", "-")}, but this journey was recorded as a ${body.replace("_", "-")}.`);
  const allowed = REQUIRED_POWERTRAIN[mode];
  if (allowed && !allowed.includes(v.powertrain)) {
    throw new JourneyInputError(`A ${v.powertrain} vehicle can't be used for a "${mode}" journey. The journey mode decides the calculation, not what you own.`);
  }
  if (v.powertrain === "electric") {
    if (!(v.consumptionKWhPerKm && v.consumptionKWhPerKm > 0)) throw new JourneyInputError("The electric vehicle has no energy consumption on file.");
  } else if (!(v.mileageKmPerUnit && v.mileageKmPerUnit > 0)) {
    throw new JourneyInputError("The vehicle has no mileage on file.");
  }
  return v;
}

function iceBreakdown(args: { distanceKm: number; mileage: number; powertrain: "petrol" | "diesel" | "cng"; share: number; label: string }): {
  b: EmissionsBreakdown;
  factor: EmissionFactor;
} {
  const factor = FUEL_FACTORS[args.powertrain];
  const unit = args.powertrain === "cng" ? "kg" : "L";
  const mileageUnit = args.powertrain === "cng" ? "km/kg" : "km/l";
  const fuel = args.distanceKm / args.mileage;
  const vehicleGrams = fuel * factor.value * 1000;
  const grams = g(vehicleGrams / args.share);
  const shareText = args.share > 1 ? ` ÷ ${args.share} occupants` : "";
  return {
    factor,
    b: {
      grams,
      formula: `${num(args.distanceKm)} km ÷ ${num(args.mileage)} ${mileageUnit} = ${num(fuel, 3)} ${unit} × ${factor.value} ${factor.unit} × 1000${shareText} = ${num(grams, 1)} g`,
      inputs: { distanceKm: args.distanceKm, mileage: `${args.mileage} ${mileageUnit}`, fuelUsed: `${num(fuel, 3)} ${unit}`, factor: `${factor.value} ${factor.unit}`, vehicle: args.label },
      factorIds: [factor.id],
      energy: { kind: "fuel", amount: fuel, unit },
    },
  };
}

/** Electricity drawn from the grid for one km, on the wall side, and the gross-up applied (1 when already wall-side). */
const wallKWhPerKm = (v: VehicleEnergySpec) => {
  const base = v.consumptionKWhPerKm ?? 0;
  return v.consumptionBasis === "wall" ? { kWh: base, gross: 1 } : { kWh: base / CHARGING_EFFICIENCY, gross: CHARGING_EFFICIENCY };
};

export function evEfficiencyOf(v: VehicleEnergySpec): EvEfficiency | null {
  if (v.powertrain !== "electric" || !v.consumptionKWhPerKm) return null;
  const ref = REFERENCE_EV[v.body];
  const kWhPerKm = v.consumptionKWhPerKm;
  return {
    kWhPerKm,
    kWhPer100Km: kWhPerKm * 100,
    kmPerKWh: 1 / kWhPerKm,
    basis: v.consumptionBasis ?? "battery",
    reference: { label: ref.label, kWhPer100Km: ref.kWhPerKm * 100, kmPerKWh: 1 / ref.kWhPerKm },
    // Compared like with like: the reference is battery-side, so a wall-side figure is converted before comparing.
    betterThanReferencePct: ((ref.kWhPerKm - (v.consumptionBasis === "wall" ? kWhPerKm * CHARGING_EFFICIENCY : kWhPerKm)) / ref.kWhPerKm) * 100,
  };
}

export function calculateJourney(input: JourneyInput): CarbonResult {
  const { mode, distanceKm } = input;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) throw new JourneyInputError("Distance must be a positive number of kilometres.");
  const at = input.at ?? Date.now();
  const occupants = mode === "ride_hail" ? Math.max(1, Math.min(8, Math.floor(input.occupants ?? 1))) : 1;
  const vehicle = checkVehicle(mode, input.vehicle);

  const { factor: grid, fellBack } = gridFactorFor(at);
  const factors: EmissionFactor[] = [];
  const assumptions: string[] = [];
  const warnings: string[] = [];
  const confidences: Confidence[] = [];
  const recordFactor = (f: EmissionFactor) => {
    if (!factors.some((x) => x.id === f.id)) factors.push(f);
    confidences.push(f.confidence);
    if (f.status === "assumption") assumptions.push(`${f.label}: ${f.notes ?? "unsourced assumption"}`);
  };

  /* ---- what the journey actually emitted ---- */
  let actual: EmissionsBreakdown;
  let kind: "ice" | "ev" | "transit" | "active";

  if (vehicle && vehicle.powertrain !== "electric") {
    kind = "ice";
    const { b, factor } = iceBreakdown({
      distanceKm,
      mileage: vehicle.mileageKmPerUnit!,
      powertrain: vehicle.powertrain as "petrol" | "diesel" | "cng",
      share: occupants,
      label: vehicle.label ?? `${vehicle.powertrain} ${vehicle.body.replace("_", "-")}`,
    });
    actual = b;
    recordFactor(factor);
    confidences.push(vehicle.confidence);
  } else if (vehicle) {
    kind = "ev";
    const { kWh: perKm, gross } = wallKWhPerKm(vehicle);
    const kWh = distanceKm * perKm;
    const grams = g((kWh * grid.value * 1000) / occupants);
    const lossText = gross === 1 ? "" : ` (battery-side ${num(vehicle.consumptionKWhPerKm!, 4)} kWh/km ÷ ${gross} charging efficiency)`;
    actual = {
      grams,
      formula: `${num(distanceKm)} km × ${num(perKm, 4)} kWh/km${lossText} = ${num(kWh, 3)} kWh × ${num(grid.value, 4)} ${grid.unit} × 1000${occupants > 1 ? ` ÷ ${occupants} occupants` : ""} = ${num(grams, 1)} g`,
      inputs: {
        distanceKm,
        consumption: `${num(vehicle.consumptionKWhPerKm! * 100, 2)} kWh/100 km (${vehicle.consumptionBasis ?? "battery"}-side)`,
        electricityDrawn: `${num(kWh, 3)} kWh`,
        gridFactor: `${num(grid.value, 4)} ${grid.unit}`,
        vehicle: vehicle.label ?? `electric ${vehicle.body.replace("_", "-")}`,
      },
      factorIds: [grid.id],
      energy: { kind: "electricity", amount: kWh, unit: "kWh" },
    };
    recordFactor(grid);
    confidences.push(vehicle.confidence);
    if (gross !== 1) assumptions.push(`Charging efficiency ${CHARGING_EFFICIENCY * 100}% applied to battery-side consumption (unsourced assumption).`);
  } else if (mode === "metro") {
    kind = "transit";
    const kWh = distanceKm * METRO_ENERGY.kWhPerPassengerKm;
    const grams = g(kWh * grid.value * 1000);
    actual = {
      grams,
      formula: `${num(distanceKm)} km × ${METRO_ENERGY.kWhPerPassengerKm} kWh/passenger-km = ${num(kWh, 3)} kWh × ${num(grid.value, 4)} ${grid.unit} × 1000 = ${num(grams, 1)} g`,
      inputs: { distanceKm, energyIntensity: `${METRO_ENERGY.kWhPerPassengerKm} kWh/passenger-km`, gridFactor: `${num(grid.value, 4)} ${grid.unit}` },
      factorIds: [grid.id],
      energy: { kind: "electricity", amount: kWh, unit: "kWh" },
    };
    recordFactor(grid);
    confidences.push(METRO_ENERGY.confidence);
    assumptions.push(`Metro energy intensity: ${METRO_ENERGY.source}.`);
  } else if (mode === "ebus") {
    kind = "transit";
    const perPassengerKm = EBUS_ENERGY.kWhPerVehicleKm / EBUS_ENERGY.averagePassengers;
    const kWh = distanceKm * perPassengerKm;
    const grams = g(kWh * grid.value * 1000);
    actual = {
      grams,
      formula: `${num(distanceKm)} km × (${num(EBUS_ENERGY.kWhPerVehicleKm, 3)} kWh/bus-km ÷ ${EBUS_ENERGY.averagePassengers} passengers) = ${num(kWh, 3)} kWh × ${num(grid.value, 4)} ${grid.unit} × 1000 = ${num(grams, 1)} g`,
      inputs: { distanceKm, busEnergy: `${num(EBUS_ENERGY.kWhPerVehicleKm, 3)} kWh/km`, averagePassengers: EBUS_ENERGY.averagePassengers, gridFactor: `${num(grid.value, 4)} ${grid.unit}` },
      factorIds: [grid.id],
      energy: { kind: "electricity", amount: kWh, unit: "kWh" },
    };
    recordFactor(grid);
    confidences.push(EBUS_ENERGY.confidence);
    assumptions.push(`Electric-bus energy and load: ${EBUS_ENERGY.source}.`);
  } else {
    kind = "active";
    const grams = g(distanceKm * ACTIVE_TRAVEL.gramsPerKm);
    actual = {
      grams,
      formula: `${num(distanceKm)} km × ${ACTIVE_TRAVEL.gramsPerKm} g/km = ${num(grams, 1)} g (no energy is converted outside the body)`,
      inputs: { distanceKm },
      factorIds: [],
      energy: { kind: "none", amount: 0, unit: null },
    };
    assumptions.push("Walking and cycling count as zero emissions at the point of energy use; food-energy emissions are outside the accounting boundary.");
  }

  /* ---- the reference journey: same distance, same boundary, a configured petrol vehicle ---- */
  const refBody: VehicleBody = vehicle ? vehicle.body : "two_wheeler";
  const ref = REFERENCE_VEHICLES[refBody];
  const refCalc = iceBreakdown({ distanceKm, mileage: ref.kmPerLitre, powertrain: "petrol", share: occupants, label: ref.label });
  recordFactor(refCalc.factor);
  assumptions.push(
    `Reference journey: ${ref.label} at ${ref.kmPerLitre} km/l — a MissionEV prototype assumption, not a measured fleet average.` +
      (vehicle ? "" : " Metro, bus and walking are compared with a petrol two-wheeler, the lowest-emitting private option."),
  );
  const baseline = { ...refCalc.b, label: ref.label };

  /* ---- avoided emissions ---- */
  const rawAvoidedGrams = g(baseline.grams - actual.grams);
  let co2AvoidedGrams = Math.max(0, Math.floor(rawAvoidedGrams));
  if (co2AvoidedGrams > UINT32_MAX) {
    warnings.push("The avoided-emissions figure exceeds the contract's uint32 limit and was capped.");
    co2AvoidedGrams = UINT32_MAX;
  }
  const exceedsReference = rawAvoidedGrams < 0;
  if (exceedsReference) warnings.push("Your journey emitted more than the reference scenario.");

  const distanceMeters = Math.round(distanceKm * 1000);
  if (distanceMeters > UINT32_MAX) warnings.push("The distance exceeds the contract's uint32 metre limit.");
  if (fellBack) warnings.push(grid.notes ?? "Latest published grid factor used.");

  const contract = contractModeFor(mode, vehicle);
  const reward = rewardEligibility({ mode, vehicle, co2AvoidedGrams, contract });

  if (vehicle?.efficiencySource === "category-default") {
    assumptions.push("Vehicle efficiency is a category default, not your vehicle's own figure; enter your mileage or consumption for a better estimate.");
  }
  if (occupants > 1) assumptions.push(`Emissions shared across ${occupants} occupants; the reference vehicle is shared the same way.`);
  if (mode === "ride_hail") assumptions.push("Ride-hail emissions cover the paid trip only; empty pick-up kilometres are not allocated to the passenger.");
  if (kind === "ev") assumptions.push("Grid transmission & distribution losses and battery manufacturing are outside the accounting boundary.");

  return {
    mode,
    distanceKm,
    distanceMeters,
    actual,
    baseline,
    rawAvoidedGrams,
    co2AvoidedGrams,
    exceedsReference,
    evEfficiency: vehicle ? evEfficiencyOf(vehicle) : null,
    contract,
    reward,
    boundary: BOUNDARY_ID,
    boundaryLabel: BOUNDARY[BOUNDARY_ID].label,
    reportingYear: grid.year,
    confidence: lowest(...confidences),
    assumptions: [...new Set(assumptions)],
    factors,
    warnings,
  };
}
