import { describe, expect, it } from "vitest";
import { TRANSPORT_MODE, contractModeFor } from "@/lib/carbon/contractMapping";
import { categoryDefaultSpec, evConsumptionFromKmPerKWh, evConsumptionFromPer100Km, evConsumptionFromRange, validateConsumption, validateMileage } from "@/lib/carbon/efficiency";
import { CEA_GRID, CHARGING_EFFICIENCY, gridFactorFor } from "@/lib/carbon/emissionFactors";
import { JourneyInputError, calculateJourney } from "@/lib/carbon/emissionsEngine";
import { previewReward, scoreAfterTrip, streakAfterTrip } from "@/lib/carbon/rewardPreview";
import type { VehicleEnergySpec } from "@/lib/carbon/types";

// A fixed instant inside FY 2025-26 (the latest year CEA v22.0 publishes), so results don't drift with the clock.
const AT = new Date("2026-02-10T09:00:00+05:30");
const GRID = CEA_GRID.inclImports[2025]; // tCO2/MWh == kgCO2/kWh
const PETROL = 2.232; // kgCO2e/L
const DIESEL = 2.675;

const petrolCar = (mileage: number, extra: Partial<VehicleEnergySpec> = {}): VehicleEnergySpec => ({
  body: "car", powertrain: "petrol", mileageKmPerUnit: mileage, efficiencySource: "user-entered", confidence: "medium", ...extra,
});
const evCar = (kWhPerKm: number, extra: Partial<VehicleEnergySpec> = {}): VehicleEnergySpec => ({
  body: "car", powertrain: "electric", consumptionKWhPerKm: kWhPerKm, consumptionBasis: "battery", efficiencySource: "user-range-battery", confidence: "medium", ...extra,
});

describe("EV energy intensity", () => {
  it("40.5 kWh over 325 km is ~0.1246 kWh/km, 12.46 kWh/100 km, 8.02 km/kWh", () => {
    const c = evConsumptionFromRange(40.5, 325);
    expect(c.kWhPerKm).toBeCloseTo(0.124615, 6);
    expect(c.kWhPer100Km).toBeCloseTo(12.4615, 4);
    expect(c.kmPerKWh).toBeCloseTo(8.0247, 4);
    expect(c.formula).toContain("40.5 kWh ÷ 325 km");
  });
  it("kWh/100 km and km/kWh inputs round-trip to the same kWh/km", () => {
    expect(evConsumptionFromPer100Km(14).kWhPerKm).toBeCloseTo(0.14, 10);
    expect(evConsumptionFromKmPerKWh(8).kWhPerKm).toBeCloseTo(0.125, 10);
  });
  it("rejects non-positive inputs and flags implausible results", () => {
    expect(() => evConsumptionFromRange(0, 300)).toThrow(RangeError);
    expect(() => evConsumptionFromRange(40, -1)).toThrow(RangeError);
    expect(validateConsumption("car", 0.1246)).toBeUndefined();
    expect(validateConsumption("car", 0.8)).toMatch(/outside the expected/);
  });
  it("validates ICE mileage by body and fuel", () => {
    expect(validateMileage("car", "petrol", 18)).toBeUndefined();
    expect(validateMileage("car", "petrol", 180)).toMatch(/Expected 5–40 km\/l/);
    expect(validateMileage("two_wheeler", "petrol", 0)).toMatch(/positive/);
  });
});

describe("electricity factor selection (CEA v22.0)", () => {
  it("uses the financial year of the trip date", () => {
    expect(gridFactorFor(new Date("2023-06-01")).factor.value).toBe(CEA_GRID.inclImports[2023]);
    expect(gridFactorFor(new Date("2024-03-31")).factor.value).toBe(CEA_GRID.inclImports[2023]); // still FY 2023-24
    expect(gridFactorFor(new Date("2024-04-01")).factor.value).toBe(CEA_GRID.inclImports[2024]);
    expect(gridFactorFor(AT).factor.year).toBe("FY 2025-26");
  });
  it("falls back to the latest published year and says so", () => {
    const r = gridFactorFor(new Date("2027-09-01"));
    expect(r.fellBack).toBe(true);
    expect(r.factor.value).toBe(CEA_GRID.inclImports[2025]);
    expect(r.factor.notes).toMatch(/not published yet/);
  });
  it("is the national weighted average (~0.675 tCO2/MWh for FY 2025-26), not a CDM margin", () => {
    const f = gridFactorFor(AT).factor;
    expect(f.value).toBeCloseTo(0.675, 3);
    expect(f.unit).toBe("kgCO2/kWh");
    expect(f.method).toMatch(/Location-based average/);
    expect(f.status).toBe("primary");
  });
});

describe("ICE journeys", () => {
  it("petrol: litres = km ÷ (km/l); grams = litres × factor", () => {
    const r = calculateJourney({ mode: "private_petrol_car", distanceKm: 10, vehicle: petrolCar(20), at: AT });
    expect(r.actual.energy).toEqual({ kind: "fuel", amount: 0.5, unit: "L" });
    expect(r.actual.grams).toBeCloseTo(0.5 * PETROL * 1000, 6); // 1116 g
  });
  it("diesel uses the diesel factor", () => {
    const r = calculateJourney({ mode: "private_diesel_car", distanceKm: 10, vehicle: petrolCar(15, { powertrain: "diesel" }), at: AT });
    expect(r.actual.grams).toBeCloseTo((10 / 15) * DIESEL * 1000, 5);
    expect(r.actual.factorIds).toEqual(["fuel.diesel.ttw.in.sfc2025"]);
  });
  it("a thirstier-than-reference car emits more, so avoided = 0 and the shortfall is reported, never negative", () => {
    const r = calculateJourney({ mode: "private_petrol_car", distanceKm: 10, vehicle: petrolCar(12), at: AT });
    expect(r.rawAvoidedGrams).toBeLessThan(0);
    expect(r.co2AvoidedGrams).toBe(0);
    expect(r.exceedsReference).toBe(true);
    expect(r.warnings).toContain("Your journey emitted more than the reference scenario.");
  });
  it("a petrol car better than the reference can show avoided grams but is still never rewarded", () => {
    const r = calculateJourney({ mode: "private_petrol_car", distanceKm: 10, vehicle: petrolCar(25), at: AT });
    expect(r.co2AvoidedGrams).toBeGreaterThan(0);
    expect(r.reward.eligible).toBe(false);
    expect(r.reward.reason).toMatch(/not rewarded/);
  });
});

describe("EV journeys (electricity is not free)", () => {
  it("battery-side consumption is grossed up for charging losses before the grid factor", () => {
    const r = calculateJourney({ mode: "private_ev_car", distanceKm: 10, vehicle: evCar(0.14), at: AT });
    const kWh = (10 * 0.14) / CHARGING_EFFICIENCY;
    expect(r.actual.energy.amount).toBeCloseTo(kWh, 9);
    expect(r.actual.grams).toBeCloseTo(kWh * GRID * 1000, 5);
    expect(r.actual.grams).toBeGreaterThan(0); // never "zero emission"
    expect(r.actual.grams).toBeCloseTo(1050.2, 1);
  });
  it("wall-side consumption is used as drawn from the socket (no second loss)", () => {
    const r = calculateJourney({ mode: "private_ev_car", distanceKm: 10, vehicle: evCar(0.14, { consumptionBasis: "wall" }), at: AT });
    expect(r.actual.energy.amount).toBeCloseTo(1.4, 9);
    expect(r.actual.grams).toBeCloseTo(1.4 * GRID * 1000, 5);
  });
  it("avoided = reference petrol car − EV, floored to whole grams", () => {
    const r = calculateJourney({ mode: "private_ev_car", distanceKm: 10, vehicle: evCar(0.14), at: AT });
    const raw = (10 / 18) * PETROL * 1000 - ((10 * 0.14) / 0.9) * GRID * 1000;
    expect(r.rawAvoidedGrams).toBeCloseTo(raw, 4);
    expect(r.co2AvoidedGrams).toBe(Math.floor(raw));
    expect(r.co2AvoidedGrams).toBe(189);
    expect(r.reward.eligible).toBe(true);
  });
  it("an EV that uses less electricity per km avoids more carbon over the same distance", () => {
    const efficient = calculateJourney({ mode: "private_ev_car", distanceKm: 20, vehicle: evCar(0.11), at: AT });
    const thirsty = calculateJourney({ mode: "private_ev_car", distanceKm: 20, vehicle: evCar(0.19), at: AT });
    expect(efficient.co2AvoidedGrams).toBeGreaterThan(thirsty.co2AvoidedGrams);
  });
  it("a bigger battery with a longer range is only better if kWh/km is lower", () => {
    const small = evConsumptionFromRange(30, 250).kWhPerKm; // 0.12
    const big = evConsumptionFromRange(80, 400).kWhPerKm; // 0.20
    expect(big).toBeGreaterThan(small);
    const a = calculateJourney({ mode: "private_ev_car", distanceKm: 15, vehicle: evCar(small), at: AT });
    const b = calculateJourney({ mode: "private_ev_car", distanceKm: 15, vehicle: evCar(big), at: AT });
    expect(a.co2AvoidedGrams).toBeGreaterThan(b.co2AvoidedGrams);
  });
  it("reports efficiency against a reference EV on the same (battery-side) basis", () => {
    const r = calculateJourney({ mode: "private_ev_car", distanceKm: 10, vehicle: evCar(0.1246), at: AT });
    expect(r.evEfficiency?.kWhPer100Km).toBeCloseTo(12.46, 2);
    expect(r.evEfficiency?.kmPerKWh).toBeCloseTo(8.026, 2);
    expect(r.evEfficiency?.betterThanReferencePct).toBeCloseTo(11, 0);
    const wall = calculateJourney({ mode: "private_ev_car", distanceKm: 10, vehicle: evCar(0.14 / 0.9, { consumptionBasis: "wall" }), at: AT });
    expect(wall.evEfficiency?.betterThanReferencePct).toBeCloseTo(0, 6); // same car, same answer on either basis
  });
  it("EV two-wheeler is compared with a petrol two-wheeler", () => {
    const r = calculateJourney({
      mode: "private_ev_2w", distanceKm: 10, at: AT,
      vehicle: { body: "two_wheeler", powertrain: "electric", consumptionKWhPerKm: 0.03, consumptionBasis: "battery", efficiencySource: "user-entered", confidence: "medium" },
    });
    expect(r.baseline.grams).toBeCloseTo((10 / 50) * PETROL * 1000, 6);
    expect(r.co2AvoidedGrams).toBe(Math.floor(r.baseline.grams - r.actual.grams));
    expect(r.contract.mode).toBe(TRANSPORT_MODE.EV_2W);
  });
});

describe("public transport and active travel need no vehicle", () => {
  it("metro is energy per passenger-km × grid factor", () => {
    const r = calculateJourney({ mode: "metro", distanceKm: 10, at: AT });
    expect(r.actual.grams).toBeCloseTo(10 * 0.041 * GRID * 1000, 4);
    expect(r.co2AvoidedGrams).toBe(Math.floor((10 / 50) * PETROL * 1000 - 10 * 0.041 * GRID * 1000));
    expect(r.reward.eligible).toBe(true);
    expect(r.confidence).toBe("low");
    expect(r.assumptions.join(" ")).toMatch(/Metro energy intensity/);
  });
  it("electric bus is bus energy ÷ average load per passenger-km", () => {
    const r = calculateJourney({ mode: "ebus", distanceKm: 10, at: AT });
    expect(r.actual.grams).toBeCloseTo(((10 * (1 / 1.06)) / 25) * GRID * 1000, 4);
    expect(r.contract.mode).toBe(TRANSPORT_MODE.EBUS);
  });
  it("walking and cycling emit nothing and avoid the whole reference", () => {
    const r = calculateJourney({ mode: "active", distanceKm: 3, at: AT });
    expect(r.actual.grams).toBe(0);
    expect(r.co2AvoidedGrams).toBe(Math.floor((3 / 50) * PETROL * 1000));
    expect(r.contract.mode).toBe(TRANSPORT_MODE.ACTIVE);
  });
});

describe("ride-hailing is classified by the vehicle that carried you", () => {
  it("an EV owner in a petrol cab earns nothing: the journey mode decides, not ownership", () => {
    const cab = calculateJourney({ mode: "ride_hail", distanceKm: 12, vehicle: petrolCar(20, { label: "Dzire (receipt)" }), at: AT });
    expect(cab.reward.eligible).toBe(false);
    expect(cab.contract.modeName).toBe("ICE_CAR");
  });
  it("an electric cab is calculated like an EV and maps to EV_CAR", () => {
    const cab = calculateJourney({ mode: "ride_hail", distanceKm: 12, vehicle: evCar(0.15), at: AT });
    expect(cab.reward.eligible).toBe(true);
    expect(cab.contract.mode).toBe(TRANSPORT_MODE.EV_CAR);
    expect(cab.assumptions.join(" ")).toMatch(/empty pick-up kilometres/);
  });
  it("shares the vehicle's emissions and the reference across occupants", () => {
    const solo = calculateJourney({ mode: "ride_hail", distanceKm: 12, vehicle: evCar(0.15), occupants: 1, at: AT });
    const duo = calculateJourney({ mode: "ride_hail", distanceKm: 12, vehicle: evCar(0.15), occupants: 2, at: AT });
    expect(duo.actual.grams).toBeCloseTo(solo.actual.grams / 2, 5);
    expect(duo.baseline.grams).toBeCloseTo(solo.baseline.grams / 2, 5);
  });
  it("needs a confirmed vehicle", () => {
    expect(() => calculateJourney({ mode: "ride_hail", distanceKm: 5, at: AT })).toThrow(JourneyInputError);
  });
});

describe("guards", () => {
  it("rejects a vehicle that doesn't match the journey mode", () => {
    expect(() => calculateJourney({ mode: "private_ev_car", distanceKm: 5, vehicle: petrolCar(18), at: AT })).toThrow(/can't be used/);
    expect(() => calculateJourney({ mode: "private_petrol_car", distanceKm: 5, vehicle: evCar(0.14), at: AT })).toThrow(/can't be used/);
  });
  it("rejects bad distance", () => {
    for (const d of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateJourney({ mode: "metro", distanceKm: d, at: AT })).toThrow(JourneyInputError);
    }
  });
  it("distance is converted to integer metres", () => {
    expect(calculateJourney({ mode: "metro", distanceKm: 4.3217, at: AT }).distanceMeters).toBe(4322);
  });
  it("category defaults are labelled low confidence", () => {
    const spec = categoryDefaultSpec("car", "electric");
    const r = calculateJourney({ mode: "private_ev_car", distanceKm: 5, vehicle: spec, at: AT });
    expect(r.confidence).toBe("low");
    expect(r.assumptions.join(" ")).toMatch(/category default/);
  });
  it("every result carries sources, year, unit and boundary", () => {
    const r = calculateJourney({ mode: "private_ev_car", distanceKm: 10, vehicle: evCar(0.14), at: AT });
    expect(r.reportingYear).toBe("FY 2025-26");
    expect(r.boundary).toBe("energy-use-direct");
    for (const f of r.factors) {
      expect(f.unit).toBeTruthy();
      expect(f.source).toBeTruthy();
      expect(f.year).toBeTruthy();
      expect(f.status).toMatch(/primary|secondary|assumption/);
    }
    expect(r.actual.formula).toMatch(/kWh/);
  });
});

describe("contract mode mapping", () => {
  it("keeps the exact TransportMode numbering", () => {
    expect(TRANSPORT_MODE).toEqual({ EV_CAR: 0, EV_2W: 1, METRO: 2, EBUS: 3, ACTIVE: 4, ICE_CAR: 5, ICE_SUV: 6 });
  });
  it("has no mode for ICE two-wheelers or CNG, and says why", () => {
    const two = contractModeFor("private_ice_2w");
    expect(two).toMatchObject({ supported: false, mode: null });
    expect(two.reason).toMatch(/two-wheeler/);
    expect(contractModeFor("ride_hail", petrolCar(20, { powertrain: "cng" }))).toMatchObject({ supported: false });
    expect(contractModeFor("ride_hail", undefined).supported).toBe(false);
  });
  it("SUVs map to ICE_SUV", () => {
    expect(contractModeFor("private_petrol_car", petrolCar(12, { isSuv: true })).mode).toBe(TRANSPORT_MODE.ICE_SUV);
  });
});

describe("reward preview mirrors the contract formula", () => {
  const t0 = Date.UTC(2026, 1, 10, 12) / 1000;
  it("first trip: streak 1, 20 MEV/kg, +10 MEV EV bonus", () => {
    const p = previewReward({ commuter: { streakDays: 0, lastTripTimestamp: 0 }, mode: TRANSPORT_MODE.EV_CAR, co2AvoidedGrams: 189, nowSec: t0 });
    expect(p.streakDays).toBe(1);
    expect(p.baseWei).toBe(BigInt("3780000000000000000"));
    expect(p.rewardWei).toBe(BigInt("13780000000000000000"));
  });
  it("streak multiplier steps at 5, 10 and 20 days", () => {
    const at = (streak: number) => previewReward({ commuter: { streakDays: streak - 1, lastTripTimestamp: t0 - 86400 }, mode: TRANSPORT_MODE.EBUS, co2AvoidedGrams: 1000, nowSec: t0 }).multiplierBps;
    expect([at(4), at(5), at(9), at(10), at(19), at(20)]).toEqual([10000, 15000, 15000, 20000, 20000, 30000]);
  });
  it("same-day trips keep the streak but still mint", () => {
    expect(streakAfterTrip({ streakDays: 3, lastTripTimestamp: t0 - 3600 }, t0)).toBe(3);
    expect(streakAfterTrip({ streakDays: 3, lastTripTimestamp: t0 - 3 * 86400 }, t0)).toBe(1);
  });
  it("mode bonus is paid even for zero avoided grams (a contract property, so the oracle must not sign such trips)", () => {
    const p = previewReward({ commuter: { streakDays: 0, lastTripTimestamp: 0 }, mode: TRANSPORT_MODE.ACTIVE, co2AvoidedGrams: 0, nowSec: t0 });
    expect(p.rewardWei).toBe(BigInt("15000000000000000000"));
  });
  it("ICE modes get no bonus; carbon score steps match the contract", () => {
    expect(previewReward({ commuter: { streakDays: 0, lastTripTimestamp: 0 }, mode: TRANSPORT_MODE.ICE_CAR, co2AvoidedGrams: 0, nowSec: t0 }).rewardWei).toBe(BigInt(0));
    expect(scoreAfterTrip(0, 100)).toBe(502);
    expect(scoreAfterTrip(502, 600)).toBe(506);
    expect(scoreAfterTrip(998, 5000)).toBe(1000);
  });
});
