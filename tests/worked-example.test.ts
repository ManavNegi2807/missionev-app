import { describe, expect, it } from "vitest";
import { sampleJourney } from "@/lib/landing/sample";

/**
 * The README's "How the credit is calculated" table. These figures are pinned here so the README cannot drift away from the
 * engine: if a factor or the reward formula changes, this fails and the table must be updated with it.
 * 10 km, first day of a streak, FY 2025-26 grid factor, the sample EV (40.5 kWh / 325 km) and the 18 km/l reference car.
 */
describe("README worked example: 10 km, day 1 of a streak", () => {
  const row = (id: Parameters<typeof sampleJourney>[0]) => sampleJourney(id, 10, 1);

  it("walking: nothing emitted, compared with the petrol two-wheeler, with the 15 MEV bonus", () => {
    const r = row("active");
    expect(r.referenceGrams).toBeCloseTo(446.4, 1);
    expect(r.actualGrams).toBe(0);
    expect(r.avoidedGrams).toBe(446);
    expect(r.mev).toBeCloseTo(23.92, 2); // 446 g x 20 MEV/kg + 15
  });

  it("metro: electricity at the grid factor, 0.041 kWh per passenger-km, with the 10 MEV bonus", () => {
    const r = row("metro");
    expect(r.actualGrams).toBeCloseTo(276.79, 2); // 10 km x 0.041 kWh x 675.1 g/kWh
    expect(r.avoidedGrams).toBe(169);
    expect(r.mev).toBeCloseTo(13.38, 2);
  });

  it("electric bus: earns the base reward only, because the contract has no e-bus bonus", () => {
    const r = row("ebus");
    expect(r.actualGrams).toBeCloseTo(254.75, 2);
    expect(r.avoidedGrams).toBe(191);
    expect(r.modeBonusMev).toBe(0);
    expect(r.mev).toBeCloseTo(3.82, 2);
  });

  it("electric car: not zero-emission (the power station emits), compared with a petrol car", () => {
    const r = row("ev_car");
    expect(r.referenceGrams).toBeCloseTo(1240, 1); // 10 km / 18 km/l x 2232 g/l
    expect(r.actualGrams).toBeCloseTo(934.75, 2); // 10 km x (0.1246 / 0.9) kWh/km x 675.1 g/kWh
    expect(r.avoidedGrams).toBe(305);
    expect(r.mev).toBeCloseTo(16.1, 2);
  });

  it("petrol car: measured, avoids nothing, and is never rewarded", () => {
    const r = row("petrol_car");
    expect(r.actualGrams).toBeCloseTo(1240, 1);
    expect(r.avoidedGrams).toBe(0);
    expect(r.eligible).toBe(false);
    expect(r.mev).toBe(0);
  });
});
