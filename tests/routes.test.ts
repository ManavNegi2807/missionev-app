import { describe, expect, it } from "vitest";
import { POST as calculate } from "@/app/api/trips/calculate/route";
import { POST as signTrip } from "@/app/api/sign-trip/route";
import { integrationStatus, readConfig } from "@/server/config";

const post = (body: unknown, raw = false) => new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: raw ? (body as string) : JSON.stringify(body) });
const KEY = `0x${"ab".repeat(32)}`;
const ADDR = `0x${"12".repeat(20)}`;

describe("server configuration", () => {
  it("is DEMO until the contract, RPC and oracle key are all set, and names what is missing", () => {
    const none = integrationStatus(readConfig({}));
    expect(none.mode).toBe("DEMO");
    expect(none.missing).toEqual(["MISSIONEV_CONTRACT_ADDRESS", "PORTAL_RPC_URL", "ORACLE_PRIVATE_KEY"]);
    const live = integrationStatus(readConfig({ MISSIONEV_CONTRACT_ADDRESS: ADDR, PORTAL_RPC_URL: "https://rpc.example", ORACLE_PRIVATE_KEY: KEY }));
    expect(live.mode).toBe("LIVE");
  });
  it("never exposes secrets in the status object", () => {
    const status = integrationStatus(readConfig({ MISSIONEV_CONTRACT_ADDRESS: ADDR, PORTAL_RPC_URL: "https://rpc.example", ORACLE_PRIVATE_KEY: KEY }));
    expect(JSON.stringify(status)).not.toContain(KEY);
  });
  it("says receipt OCR runs in the browser, so no server setting or image upload is involved", () => {
    expect(integrationStatus(readConfig({})).ocr).toEqual({ engine: "tesseract.js", runsIn: "browser" });
  });
  it("has no phone or OTP sign-in left: the account is a wallet address", () => {
    expect(Object.keys(integrationStatus(readConfig({})))).not.toContain("otp");
  });
  it("ignores malformed keys and addresses instead of half-using them", () => {
    const c = readConfig({ ORACLE_PRIVATE_KEY: "0x1234", MISSIONEV_CONTRACT_ADDRESS: "nope", PORTAL_RPC_URL: "ftp://x" });
    expect(c).toMatchObject({ oracleKey: null, contract: null, rpcUrl: null });
  });
  it("the oracle key has no NEXT_PUBLIC_ spelling anywhere in the source tree", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : /\.(ts|tsx|mjs)$/.test(f) ? [join(dir, f)] : []));
    const hits = walk("src").filter((f) => /NEXT_PUBLIC_[A-Z_]*(PRIVATE|SECRET|ORACLE_KEY)/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
    // and the signer is only imported by server code
    const importers = walk("src").filter((f) => /from "@\/lib\/oracle\/sign"/.test(readFileSync(f, "utf8")));
    expect(importers.every((f) => f.replaceAll("\\", "/").startsWith("src/server/"))).toBe(true);
  });
});

describe("route handlers", () => {
  it("calculate runs the shared engine and refuses a vehicle that doesn't match the mode", async () => {
    const ok = await calculate(post({ mode: "metro", distanceKm: 10 }));
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { carbon: { co2AvoidedGrams: number; contract: { modeName: string } } };
    expect(body.carbon.contract.modeName).toBe("METRO");
    expect(body.carbon.co2AvoidedGrams).toBeGreaterThan(0);
    const bad = await calculate(post({ mode: "private_ev_car", distanceKm: 5, vehicle: { body: "car", powertrain: "petrol", mileageKmPerUnit: 18, efficiencySource: "user-entered", confidence: "medium" } }));
    expect(bad.status).toBe(400);
    expect((await calculate(post("not json", true))).status).toBe(400);
  });
  it("the verifier route (/api/sign-trip) signs nothing when it isn't configured, and rejects garbage before that", async () => {
    expect((await signTrip(post({ nope: true }))).status).toBe(400);
    const valid = { commuter: ADDR, proof: { message: "-", signature: `0x${"0".repeat(130)}` }, trip: { clientTripId: "trip_abcd", mode: "metro", source: "gps", startedAt: 1, endedAt: 2, distanceKm: 1, durationSec: 1, samples: [[1, 1, 1, 1], [1, 1, 2, 1]], vehicle: null, rideHail: null, occupants: 1 } };
    const res = await signTrip(post(valid));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "unavailable", reason: expect.stringContaining("Nothing was signed") });
  });
});
