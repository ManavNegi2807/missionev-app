import { describe, expect, it } from "vitest";
import { parseReceipt } from "@/lib/ocr/receipt";
import type { CatalogEntry } from "@/lib/transport/catalog";
import { CATALOG, findEntry, findModelInText } from "@/lib/transport/catalog";
import { EMPTY_DRAFT, maskRegistration, resolveDraft, vehicleSpecOf, type RegisteredVehicle, type VehicleDraft } from "@/lib/transport/profile";
import { EMPTY_RIDE, rideFromExtraction, resolveRideHail, type RideHailForm } from "@/lib/transport/rideHail";

const d = (over: Partial<VehicleDraft>): VehicleDraft => ({ ...EMPTY_DRAFT, manufacturer: "Maruti Suzuki", model: "Swift", ...over });

describe("registration: private ICE vehicles", () => {
  it("accepts a real mileage and records it as entered by the commuter", () => {
    const r = resolveDraft(d({ mode: "private_petrol_car", mileage: "17.5" }));
    expect(r.errors).toEqual({});
    expect(r.vehicle).toMatchObject({ mode: "private_petrol_car", fuelType: "petrol", mileageKmPerLitre: 17.5, efficiencySource: "user-entered", confidence: "medium" });
  });
  it("rejects missing, non-positive and implausible mileage", () => {
    expect(resolveDraft(d({ mode: "private_petrol_car", mileage: "" })).errors.mileage).toMatch(/Enter your mileage/);
    expect(resolveDraft(d({ mode: "private_petrol_car", mileage: "-4" })).errors.mileage).toMatch(/positive/);
    expect(resolveDraft(d({ mode: "private_petrol_car", mileage: "180" })).errors.mileage).toMatch(/Expected 5–40 km\/l/);
  });
  it("requires a manufacturer and model", () => {
    expect(resolveDraft(d({ mode: "private_petrol_car", manufacturer: "", model: "", mileage: "18" })).errors).toMatchObject({ manufacturer: expect.any(String), model: expect.any(String) });
  });
  it("'Don't know your mileage?': the shipped catalogue has no figures, so it never invents one", () => {
    expect(CATALOG.every((e) => e.efficiency === undefined)).toBe(true);
    const est = resolveDraft(d({ mode: "private_diesel_car", unknown: true, fallback: "estimate", estimate: "14" }));
    expect(est.vehicle).toMatchObject({ efficiencySource: "user-entered", confidence: "low", mileageKmPerLitre: 14, fuelType: "diesel" });
    const def = resolveDraft(d({ mode: "private_petrol_car", unknown: true, fallback: "default" }));
    expect(def.vehicle).toMatchObject({ efficiencySource: "category-default", confidence: "low" });
    expect(def.vehicle?.efficiencyNote).toMatch(/not your vehicle's own figure/);
  });
  it("uses a catalogue figure only when one has been added with a source", () => {
    const cat: CatalogEntry[] = [{ manufacturer: "Maruti Suzuki", model: "Swift", body: "car", powertrain: "petrol", efficiency: { mileageKmPerUnit: 22.4, source: "Test certificate 123", year: "2025", confidence: "medium" } }];
    const r = resolveDraft(d({ mode: "private_petrol_car", unknown: true }), cat);
    expect(r.vehicle).toMatchObject({ efficiencySource: "catalog", mileageKmPerLitre: 22.4 });
    expect(r.vehicle?.efficiencyNote).toContain("Test certificate 123");
    expect(r.match?.model).toBe("Swift");
  });
  it("masks an optional registration number", () => {
    expect(maskRegistration("DL 3C AB 1234")).toBe("DL ••••• 1234");
    expect(maskRegistration("12")).toBeUndefined();
    const v = resolveDraft(d({ mode: "private_petrol_car", mileage: "18", registration: "DL3CAB1234" })).vehicle!;
    expect(JSON.stringify(v)).not.toContain("3CAB");
  });
  it("flags an SUV from the catalogue", () => {
    expect(findEntry({ manufacturer: "Hyundai", model: "creta", body: "car", powertrain: "petrol" })?.isSuv).toBe(true);
    expect(resolveDraft(d({ mode: "private_petrol_car", manufacturer: "Hyundai", model: "Creta", mileage: "16" })).vehicle?.isSuv).toBe(true);
  });
});

describe("registration: private EVs (kWh, never km/l)", () => {
  it("battery capacity + range → 0.1246 kWh/km, battery-side, from real arithmetic", () => {
    const r = resolveDraft(d({ mode: "private_ev_car", manufacturer: "Tata", model: "Nexon EV", evMethod: "range", battery: "40.5", range: "325" }));
    expect(r.errors).toEqual({});
    expect(r.derived?.kWhPerKm).toBeCloseTo(0.12462, 4);
    expect(r.derived?.kWhPer100Km).toBeCloseTo(12.46, 2);
    expect(r.vehicle).toMatchObject({ efficiencySource: "user-range-battery", usableBatteryCapacityKWh: 40.5, fullChargeRangeKm: 325, consumptionBasis: "battery" });
    expect(r.vehicle?.consumptionKWhPer100Km).toBeCloseTo(12.4615, 3);
    expect(r.vehicle?.efficiencyNote).toMatch(/real consumption varies|estimate/);
  });
  it("direct energy efficiency in either unit, and the basis is remembered", () => {
    const a = resolveDraft(d({ mode: "private_ev_car", evMethod: "efficiency", efficiency: "14", efficiencyUnit: "kWh/100km", efficiencyBasis: "wall" }));
    expect(a.vehicle).toMatchObject({ consumptionKWhPer100Km: 14, consumptionBasis: "wall", efficiencySource: "user-kwh-per-100km" });
    const b = resolveDraft(d({ mode: "private_ev_car", evMethod: "efficiency", efficiency: "8", efficiencyUnit: "km/kWh" }));
    expect(b.vehicle?.consumptionKWhPer100Km).toBeCloseTo(12.5, 6);
  });
  it("rejects typos (a 400 kWh battery with a 50 km range) rather than saving nonsense", () => {
    const r = resolveDraft(d({ mode: "private_ev_car", evMethod: "range", battery: "400", range: "50" }));
    expect(r.vehicle).toBeNull();
    expect(Object.keys(r.errors).length).toBeGreaterThan(0);
  });
  it("'Don't know battery capacity / energy consumption?' falls back to an estimate or a labelled default, never a made-up model figure", () => {
    expect(resolveDraft(d({ mode: "private_ev_car", unknown: true, fallback: "default" })).vehicle).toMatchObject({ efficiencySource: "category-default", confidence: "low" });
    expect(resolveDraft(d({ mode: "private_ev_2w", unknown: true, fallback: "estimate", estimate: "3.5" })).vehicle).toMatchObject({ efficiencySource: "user-kwh-per-100km", confidence: "low", consumptionKWhPer100Km: 3.5 });
    expect(resolveDraft(d({ mode: "private_ev_car", unknown: true, fallback: "estimate", estimate: "" })).errors.estimate).toBeTruthy();
  });
  it("converts a saved vehicle to the engine's spec (EV range/battery → kWh per km)", () => {
    const v = resolveDraft(d({ mode: "private_ev_car", evMethod: "range", battery: "40.5", range: "325" })).vehicle!;
    const spec = vehicleSpecOf({ ...v, id: "x" } as RegisteredVehicle);
    expect(spec).toMatchObject({ body: "car", powertrain: "electric", consumptionBasis: "battery" });
    expect(spec.consumptionKWhPerKm).toBeCloseTo(40.5 / 325, 6);
  });
});

describe("ride-hail: classified by the vehicle that carried you", () => {
  const base: RideHailForm = { ...EMPTY_RIDE, provider: "ola", receiptDistance: "12.4", manufacturer: "Maruti Suzuki", model: "Dzire", body: "car", fuel: "petrol", fallback: "default" };
  it("builds a labelled, low-confidence vehicle spec from a confirmed receipt", () => {
    const r = resolveRideHail({ ...base, confirmed: true });
    expect(r.errors).toEqual({});
    expect(r.vehicle?.spec).toMatchObject({ powertrain: "petrol", efficiencySource: "category-default", confidence: "low" });
    expect(r.info).toMatchObject({ provider: "ola", receipt: { distanceKm: 12.4, confirmedByUser: true, source: "manual" } });
  });
  it("supports electric and CNG cabs, and rejects incomplete details", () => {
    expect(resolveRideHail({ ...base, fuel: "electric" }).vehicle?.spec).toMatchObject({ powertrain: "electric" });
    expect(resolveRideHail({ ...base, fuel: "cng" }).vehicle?.spec).toMatchObject({ powertrain: "cng", efficiencySource: "category-default" });
    expect(resolveRideHail({ ...base, provider: "", receiptDistance: "", fuel: "" }).errors).toMatchObject({ provider: expect.any(String), receiptDistance: expect.any(String), fuel: expect.any(String) });
  });
  it("OCR pre-fills the form but never confirms it", () => {
    const x = parseReceipt(["Uber", "Trip distance: 8.2 km", "Ride: Tata Tigor EV"], undefined);
    const f = rideFromExtraction(x);
    expect(f).toMatchObject({ provider: "uber", receiptDistance: "8.2", source: "ocr-reviewed", confirmed: false });
    expect(f.fuel).toBe("electric"); // suggested by the model list, to be confirmed by the commuter
  });
});

describe("receipt parser (synthetic sample text, not real receipts)", () => {
  it("reads provider, distance, date, model and class", () => {
    const x = parseReceipt(["Ola Cabs", "Thank you for riding with Ola", "Ride: Prime Sedan", "Vehicle: Maruti Dzire", "Trip distance 12.4 km", "Date 12 Oct 2026", "Driver: Someone Private", "Pickup: Connaught Place", "Drop: Saket"]);
    expect(x).toMatchObject({ provider: "ola", distanceKm: 12.4, tripDate: "2026-10-12", serviceClass: "Prime Sedan", bodyHint: "car", model: { model: "Dzire", powertrain: "petrol" }, pickup: "Connaught Place", drop: "Saket" });
    expect(JSON.stringify(x)).not.toContain("Someone Private"); // driver details are never read out
    expect(x.confidence.distance).toBe("high");
  });
  it("is honest when text is missing or ambiguous", () => {
    const none = parseReceipt(["Total fare ₹312", "Thanks"]);
    expect(none).toMatchObject({ provider: null, distanceKm: null, model: null });
    expect(none.notes.join(" ")).toMatch(/No ride provider|No trip distance|wasn't recognised/);
    const two = parseReceipt(["Rapido", "Bike", "2.5 km", "pickup 1.2 km away"]);
    expect(two.provider).toBe("rapido");
    expect(two.bodyHint).toBe("two_wheeler");
    expect(two.confidence.distance).toBe("low");
    expect(two.notes.join(" ")).toMatch(/Several distances/);
    expect(parseReceipt(["Uber Auto", "5 km"]).bodyHint).toBe("three_wheeler");
  });
  it("matches catalogued models only on whole names", () => {
    expect(findModelInText("Vehicle Tata Nexon EV white")?.model).toBe("Nexon EV");
    expect(findModelInText("Nexons are great")).toBeNull();
  });
});
