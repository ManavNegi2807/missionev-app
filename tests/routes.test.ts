import { describe, expect, it } from "vitest";
import { POST as otpRequest } from "@/app/api/auth/otp/request/route";
import { POST as otpVerify } from "@/app/api/auth/otp/verify/route";
import { POST as calculate } from "@/app/api/trips/calculate/route";
import { POST as ocr } from "@/app/api/vision/ocr/route";
import { POST as signTrip } from "@/app/api/oracle/sign-trip/route";
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
    const status = integrationStatus(readConfig({ MISSIONEV_CONTRACT_ADDRESS: ADDR, PORTAL_RPC_URL: "https://rpc.example", ORACLE_PRIVATE_KEY: KEY, AZURE_VISION_KEY: "visionsecret", AZURE_VISION_ENDPOINT: "https://v.example" }));
    const text = JSON.stringify(status);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("visionsecret");
    expect(status.ocr.configured).toBe(true);
  });
  it("ignores malformed keys and addresses instead of half-using them", () => {
    const c = readConfig({ ORACLE_PRIVATE_KEY: "0x1234", MISSIONEV_CONTRACT_ADDRESS: "nope", PORTAL_RPC_URL: "ftp://x" });
    expect(c).toMatchObject({ oracleKey: null, contract: null, rpcUrl: null });
  });
  it("the oracle key has no NEXT_PUBLIC_ spelling anywhere in the source tree", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : /\.(ts|tsx|mjs)$/.test(f) ? [join(dir, f)] : []));
    const hits = walk("src").filter((f) => /NEXT_PUBLIC_[A-Z_]*(PRIVATE|SECRET|ORACLE_KEY|VISION_KEY)/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
    // and the signer is only imported by server code
    const importers = walk("src").filter((f) => /from "@\/lib\/oracle\/sign"/.test(readFileSync(f, "utf8")));
    expect(importers.every((f) => f.replaceAll("\\", "/").startsWith("src/server/"))).toBe(true);
  });
});

describe("route handlers", () => {
  it("OTP is a labelled demo: validates the number, never claims SMS delivery, checks the OTP on the server", async () => {
    const bad = await otpRequest(post({ phone: "123" }));
    expect(bad.status).toBe(400);
    const ok = await otpRequest(post({ phone: "9876543210" }));
    expect(await ok.json()).toMatchObject({ status: "sent", delivery: "demo" });
    expect((await otpVerify(post({ phone: "9876543210", otp: "000000" }))).status).toBe(401);
    const verified = await otpVerify(post({ phone: "9876543210", otp: "123456" }));
    expect(await verified.json()).toMatchObject({ status: "verified", delivery: "demo", authenticated: false });
  });
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
  it("OCR answers 501 (not a fake result) when Azure isn't configured", async () => {
    const res = await ocr(new Request("http://localhost/x", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(501);
    expect(await res.json()).toMatchObject({ status: "not-configured" });
  });
  it("the oracle route signs nothing when it isn't configured, and rejects garbage before that", async () => {
    expect((await signTrip(post({ nope: true }))).status).toBe(400);
    const valid = { commuter: ADDR, proof: { message: "-", signature: `0x${"0".repeat(130)}` }, trip: { clientTripId: "trip_abcd", mode: "metro", source: "gps", startedAt: 1, endedAt: 2, distanceKm: 1, durationSec: 1, samples: [[1, 1, 1, 1], [1, 1, 2, 1]], vehicle: null, rideHail: null, occupants: 1 } };
    const res = await signTrip(post(valid));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "unavailable", reason: expect.stringContaining("Nothing was signed") });
  });
});
