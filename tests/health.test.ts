import { describe, expect, it } from "vitest";
import { LIMITS, assess, formatAge, type EvmStatus, type NativeStatus } from "../scripts/health-core.mjs";

const NOW = 1_800_000_000;
const evm = (over: Partial<EvmStatus> = {}): EvmStatus => ({ chainId: 420420777, head: 1000, headTimestamp: NOW - 5, ...over });
const native = (over: Partial<NativeStatus> = {}): NativeStatus => ({ chain: "PortaldotV3 Test", head: 1001, finalized: 999, peers: 1, isSyncing: false, shouldHavePeers: true, ...over });
const texts = (r: ReturnType<typeof assess>, level: string) => r.findings.filter((f) => f.level === level).map((f) => f.text);

describe("Portal V3 network health rules", () => {
  it("is healthy when both endpoints answer, agree, and the head is fresh", () => {
    const r = assess({ evm: evm(), native: native(), now: NOW });
    expect(r.verdict).toBe("healthy");
    expect(texts(r, "warn")).toEqual([]);
    expect(texts(r, "fail")).toEqual([]);
  });

  it("catches the frozen EVM endpoint we hit on 31 October: an old head while the native node moves on", () => {
    const r = assess({ evm: evm({ head: 265334, headTimestamp: NOW - 4 * 3600 }), native: native({ head: 270000, finalized: 269998 }), now: NOW });
    expect(r.verdict).toBe("unhealthy");
    expect(texts(r, "fail").join(" ")).toContain("not following the chain");
    expect(texts(r, "fail").join(" ")).toContain("blocks behind the native node");
  });

  it("flags an old head even when the native node cannot be reached", () => {
    const r = assess({ evm: evm({ headTimestamp: NOW - 600 }), native: null, now: NOW });
    expect(r.verdict).toBe("unhealthy");
    expect(texts(r, "warn").join(" ")).toContain("could not be cross-checked");
  });

  it("refuses the wrong chain", () => {
    expect(assess({ evm: evm({ chainId: 1 }), native: native(), now: NOW }).verdict).toBe("unhealthy");
  });

  it("is unhealthy when the EVM endpoint does not answer", () => {
    expect(assess({ evm: null, native: native(), now: NOW }).verdict).toBe("unhealthy");
  });

  it("is only degraded when the native node is unreachable but the EVM endpoint is fresh", () => {
    expect(assess({ evm: evm(), native: null, now: NOW }).verdict).toBe("degraded");
  });

  it("warns about syncing, a lonely node, and slow finality without failing the check", () => {
    expect(assess({ evm: evm(), native: native({ isSyncing: true }), now: NOW }).verdict).toBe("degraded");
    expect(assess({ evm: evm(), native: native({ peers: 0 }), now: NOW }).verdict).toBe("degraded");
    const slow = assess({ evm: evm(), native: native({ head: 1001, finalized: 1001 - LIMITS.maxFinalityLagBlocks - 1 }), now: NOW });
    expect(slow.verdict).toBe("degraded");
    expect(texts(slow, "warn").join(" ")).toContain("Finality");
  });

  it("tolerates a small lag, and an EVM head that is a block ahead of the native reading", () => {
    expect(assess({ evm: evm({ head: 995 }), native: native({ head: 1001 }), now: NOW }).verdict).toBe("healthy");
    expect(assess({ evm: evm({ head: 1002 }), native: native({ head: 1001 }), now: NOW }).verdict).toBe("healthy");
  });

  it("formats ages for people", () => {
    expect(formatAge(45)).toBe("45 s");
    expect(formatAge(600)).toBe("10 min");
    expect(formatAge(4 * 3600)).toBe("4.0 h");
  });
});
