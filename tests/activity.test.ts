import { describe, expect, it, vi } from "vitest";
import { ACTIVITY_LIMIT, INDEXER_TX_URL, evaluateActivity, txLink, type ActivityProbe, type RawCommute, type RawMint } from "@/server/activity";

// `connection()` only works inside a real request; the handler itself is what is under test.
vi.mock("next/server", () => ({ connection: async () => undefined }));

const WHO = `0x${"ab".repeat(20)}`;
const commute = (n: number, over: Partial<RawCommute> = {}): RawCommute => ({ txHash: `0x${n.toString(16).padStart(64, "0")}`, blockNumber: 1000 + n, logIndex: 0, commuter: WHO, tripId: `0x${"cd".repeat(32)}`, mode: 2, distanceMeters: 5000, co2AvoidedGrams: 700, ...over });

function chain(over: { head?: number | Error; commutes?: (f: number, t: number) => RawCommute[] | Error; mints?: RawMint[] | Error; time?: number | null | Error } = {}): ActivityProbe {
  const give = <T,>(v: T | Error): Promise<T> => (v instanceof Error ? Promise.reject(v) : Promise.resolve(v));
  return {
    head: () => give(over.head ?? 5000),
    commutes: (f, t) => give(over.commutes ? over.commutes(f, t) : []),
    mints: () => give(over.mints ?? []),
    blockTime: () => give(over.time === undefined ? 1_800_000_000 : over.time),
  };
}

describe("recent on-chain activity", () => {
  it("lists the latest events newest first, capped at 10, with the exact minted amount and a link", async () => {
    const all = Array.from({ length: 14 }, (_, i) => commute(i));
    const mint = (c: RawCommute): RawMint => ({ txHash: c.txHash, to: c.commuter, value: BigInt("12500000000000000000") });
    const r = await evaluateActivity(chain({ commutes: () => all, mints: all.map(mint) }), { explorerUrl: "https://scan.example/" });
    expect(r.verdict).toBe("ok");
    expect(r.events).toHaveLength(ACTIVITY_LIMIT);
    expect(r.events[0].blockNumber).toBe(1013);
    expect(r.events[0]).toMatchObject({ modeName: "METRO", co2AvoidedGrams: 700, mintedWei: "12500000000000000000", timestamp: 1_800_000_000 });
    expect(r.events[0].url).toBe(`https://scan.example/tx/${r.events[0].txHash}`);
    expect(r.linkKind).toBe("explorer");
  });

  it("falls back to the indexer link when no explorer URL is configured", () => {
    expect(txLink("0xabc", "")).toBe(`${INDEXER_TX_URL}0xabc`);
  });

  it("says plainly that an empty chain is empty, and that the whole history was searched", async () => {
    const r = await evaluateActivity(chain({ head: 800 }), { floor: 100 });
    expect(r).toMatchObject({ verdict: "empty", events: [], complete: true });
    expect(r.message).toContain("no recordCommute transactions yet");
  });

  it("does not claim 'none yet' when only part of the chain could be searched", async () => {
    let n = 0;
    const r = await evaluateActivity(chain({ head: 400_000, commutes: () => (n++ === 0 ? [] : new Error("range")) }), { floor: 0 });
    expect(r.verdict).toBe("empty");
    expect(r.complete).toBe(false);
    expect(r.message).not.toContain("no recordCommute transactions yet");
  });

  it("reports an unreachable RPC without inventing rows", async () => {
    const r = await evaluateActivity(chain({ head: new Error("timeout") }));
    expect(r).toMatchObject({ verdict: "unreachable", events: [] });
    expect(r.message).toContain("did not answer");
  });

  it("reports a log-query failure (for example a range cap) as unreachable, after retrying with smaller windows", async () => {
    let calls = 0;
    const r = await evaluateActivity(
      chain({
        head: 300_000,
        commutes: () => {
          calls++;
          return new Error("range too large");
        },
      }),
    );
    expect(r).toMatchObject({ verdict: "unreachable", events: [] });
    expect(calls).toBeGreaterThan(8); // the 50k windows, then the smaller retry
  });

  it("retries with smaller windows when the RPC caps the log range, and still returns what it found", async () => {
    const r = await evaluateActivity(chain({ head: 20_000, commutes: (f, t) => (t - f > 6000 ? new Error("range") : t >= 19_000 ? [commute(1, { blockNumber: 19_500 })] : []) }));
    expect(r.verdict).toBe("ok");
    expect(r.events).toHaveLength(1);
  });

  it("still shows the rows when the minted amount or block time can't be read, leaving those fields null", async () => {
    const r = await evaluateActivity(chain({ commutes: () => [commute(1)], mints: new Error("down"), time: new Error("down") }));
    expect(r.verdict).toBe("ok");
    expect(r.events[0]).toMatchObject({ mintedWei: null, timestamp: null });
  });
});

describe("GET /api/activity", () => {
  it("answers 200 with a plain 'unreachable' result when the RPC is down, never a 500 and never made-up rows", async () => {
    const prev = process.env.PORTAL_RPC_URL;
    process.env.PORTAL_RPC_URL = "http://127.0.0.1:9"; // nothing listens here
    try {
      const { GET } = await import("@/app/api/activity/route");
      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { verdict: string; events: unknown[]; message: string };
      expect(body.verdict).toBe("unreachable");
      expect(body.events).toEqual([]);
      expect(body.message.length).toBeGreaterThan(10);
    } finally {
      if (prev === undefined) delete process.env.PORTAL_RPC_URL;
      else process.env.PORTAL_RPC_URL = prev;
    }
  }, 20_000);
});
