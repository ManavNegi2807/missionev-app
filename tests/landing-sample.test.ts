import { describe, expect, it } from "vitest";
import { isAddress } from "@/lib/account";
import { CHAIN_ID, DEPLOYED_CONTRACT, DEPLOY_PROOF_URL, DEPLOY_TX } from "@/lib/landing/facts";
import { MAX_KM, MIN_KM, SAMPLE_MODES, STREAK_STEPS, sampleJourney } from "@/lib/landing/sample";

describe("landing sample journeys (the same engine as the app)", () => {
  it("a metro trip avoids CO2 against the petrol two-wheeler reference and earns the 10 MEV clean-mode bonus", () => {
    const r = sampleJourney("metro", 10, 1);
    expect(r.referenceLabel).toMatch(/two-wheeler/);
    expect(r.referenceGrams).toBeCloseTo((10 / 50) * 2232, 3); // 446.4 g: the 50 km/l reference two-wheeler
    expect(r.avoidedGrams).toBe(Math.floor(r.referenceGrams - r.actualGrams));
    expect(r.eligible).toBe(true);
    expect(r.modeBonusMev).toBe(10);
    // 20 MEV per kg avoided, 1x streak, plus the bonus: the contract's own arithmetic
    expect(r.mev).toBeCloseTo((r.avoidedGrams * 20) / 1000 + 10, 6);
  });

  it("walking earns the larger 15 MEV bonus and emits nothing", () => {
    const r = sampleJourney("active", 5, 1);
    expect(r.actualGrams).toBe(0);
    expect(r.modeBonusMev).toBe(15);
    expect(r.mev).toBeCloseTo((r.avoidedGrams * 20) / 1000 + 15, 6);
  });

  it("a petrol car is measured but never rewarded, however far it goes", () => {
    for (const km of [1, 12, 40]) {
      const r = sampleJourney("petrol_car", km, 20);
      expect(r.eligible).toBe(false);
      expect(r.mev).toBe(0);
      expect(r.reason).toMatch(/petrol|rewarded/i);
    }
  });

  it("a car journey is compared with an average petrol car (18 km/l)", () => {
    const r = sampleJourney("ev_car", 10, 1);
    expect(r.referenceLabel).toMatch(/petrol car/);
    expect(r.referenceGrams).toBeCloseTo((10 / 18) * 2232, 3); // 1240 g
  });

  it("an EV is not zero-emission: it emits at the grid factor, so it saves less than walking", () => {
    const ev = sampleJourney("ev_car", 10, 1);
    expect(ev.actualGrams).toBeGreaterThan(0);
    expect(ev.avoidedGrams).toBeLessThan(sampleJourney("active", 10, 1).avoidedGrams);
    expect(ev.eligible).toBe(true);
  });

  it("the streak multiplier steps 1x, 1.5x, 2x, 3x at 1, 5, 10 and 20 days and scales the base reward only", () => {
    const mults = STREAK_STEPS.map((d) => sampleJourney("metro", 10, d).multiplier);
    expect(mults).toEqual([1, 1.5, 2, 3]);
    const day1 = sampleJourney("metro", 10, 1);
    const day20 = sampleJourney("metro", 10, 20);
    expect(day20.mev).toBeCloseTo(((day1.mev - 10) * 3) + 10, 6);
  });

  it("clamps distance to the slider range and survives junk input", () => {
    expect(sampleJourney("metro", 9999, 1).km).toBe(MAX_KM);
    expect(sampleJourney("metro", -4, 1).km).toBe(MIN_KM);
    expect(sampleJourney("metro", Number.NaN, 1).km).toBe(MIN_KM);
    expect(() => sampleJourney("metro", 5, 0)).not.toThrow();
  });

  it("every offered mode calculates", () => {
    for (const m of SAMPLE_MODES) expect(sampleJourney(m.id, 12, 1).referenceGrams).toBeGreaterThan(0);
  });

  it("is deterministic (no clock or randomness), so the page can be prerendered", () => {
    expect(sampleJourney("ebus", 7.5, 5)).toEqual(sampleJourney("ebus", 7.5, 5));
  });
});

describe("landing facts", () => {
  it("the contract address, deploy hash and chain id are well formed and agree with the app", () => {
    expect(isAddress(DEPLOYED_CONTRACT)).toBe(true);
    expect(DEPLOY_TX).toMatch(/^0x[0-9a-f]{64}$/);
    expect(DEPLOY_PROOF_URL).toContain(DEPLOY_TX);
    expect(CHAIN_ID).toBe(420420777);
  });
});
