import { describe, expect, it } from "vitest";
import { getAddress, hashDomain, type Hex } from "viem";
import { LIMITS, PORTAL_V3_CHAIN_ID } from "../scripts/health-core.mjs";
import { ageText } from "@/lib/landing/age";
import { DEPLOYED_CONTRACT, PUBLISHED_ORACLE, PUBLISHED_OWNER } from "@/lib/landing/facts";
import { MAX_HEAD_AGE_SEC, evaluateChain, type ChainProbe } from "@/server/chainStatus";

const ADDRESS = DEPLOYED_CONTRACT as Hex;
const NOW = 1_800_000_000_000; // ms
const domainOf = (chainId: number) =>
  hashDomain({
    domain: { name: "MissionEV", version: "1", chainId: BigInt(chainId), verifyingContract: getAddress(ADDRESS) },
    types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }] },
  });

/** A healthy chain, with anything overridable. A value that is an Error is thrown instead of returned. */
function chain(over: { chainId?: number | Error; ageSec?: number; code?: string | Error; reads?: Record<string, unknown> } = {}): ChainProbe {
  const reads: Record<string, unknown> = {
    name: "MissionEV Carbon Reward",
    symbol: "MEV",
    totalSupply: BigInt(0),
    azureOracleSigner: PUBLISHED_ORACLE,
    owner: PUBLISHED_OWNER,
    DOMAIN_SEPARATOR: domainOf(PORTAL_V3_CHAIN_ID),
    ...over.reads,
  };
  const give = <T,>(v: T | Error): Promise<T> => (v instanceof Error ? Promise.reject(v) : Promise.resolve(v));
  return {
    chainId: () => give(over.chainId ?? PORTAL_V3_CHAIN_ID),
    head: () => Promise.resolve({ number: 321_490, timestamp: Math.round(NOW / 1000 - (over.ageSec ?? 5)) }),
    code: () => give(over.code ?? `0x${"60".repeat(5088)}`),
    read: (fn) => give(reads[fn] as unknown),
  };
}
const run = (p: ChainProbe) => evaluateChain(p, { address: ADDRESS, rpc: "https://rpc.example", now: NOW });

describe("the live chain status", () => {
  it("is live when the chain is moving and the contract matches the deployment record", async () => {
    const s = await run(chain());
    expect(s.verdict).toBe("live");
    expect(s.chainId).toBe(420420777);
    expect(s.head).toEqual({ number: 321_490, ageSeconds: 5 });
    expect(s.contract).toMatchObject({
      address: ADDRESS,
      codeBytes: 5088,
      name: "MissionEV Carbon Reward",
      symbol: "MEV",
      totalSupplyWei: "0",
      oracleSigner: PUBLISHED_ORACLE,
      owner: PUBLISHED_OWNER,
      domainSeparatorOk: true,
      matchesDeploymentRecord: true,
    });
  });

  it("reports real minted supply as an exact decimal string, so nothing is rounded", async () => {
    const s = await run(chain({ reads: { totalSupply: BigInt("12345678901234567890") } }));
    expect(s.contract?.totalSupplyWei).toBe("12345678901234567890");
  });

  it("calls the endpoint stale after 120 s, the same rule as npm run network:health", async () => {
    expect(MAX_HEAD_AGE_SEC).toBe(LIMITS.maxHeadAgeSec);
    expect((await run(chain({ ageSec: 120 }))).verdict).toBe("live");
    const stale = await run(chain({ ageSec: 121 }));
    expect(stale.verdict).toBe("stale");
    expect(stale.message).toContain("2 min"); // 121 s, in words
    expect(ageText(45)).toBe("45 s");
    expect(ageText(600)).toBe("10 min");
    expect(ageText(9000)).toBe("2.5 h");
    expect(stale.contract).not.toBeNull(); // still shown, with the warning
  });

  it("never shows a negative age when the node's clock is ahead of ours", async () => {
    expect((await run(chain({ ageSec: -30 }))).head?.ageSeconds).toBe(0);
  });

  it("refuses another chain", async () => {
    const s = await run(chain({ chainId: 1 }));
    expect(s.verdict).toBe("wrong-chain");
    expect(s.contract).toBeNull();
    expect(s.message).toContain("1");
  });

  it("says so when no contract is deployed at the address", async () => {
    for (const code of ["0x", ""]) expect((await run(chain({ code }))).verdict).toBe("no-contract");
  });

  it("is unreachable, with a plain message, when the RPC fails, and never repeats the raw error", async () => {
    const boom = new Error("connect ECONNREFUSED 10.0.0.7:8545 secret-token-123");
    for (const probe of [chain({ chainId: boom }), chain({ code: boom })]) {
      const s = await run(probe);
      expect(s.verdict).toBe("unreachable");
      expect(s.contract).toBeNull();
      expect(JSON.stringify(s)).not.toMatch(/ECONNREFUSED|secret-token|10\.0\.0\.7/);
    }
    const down = await run(chain({ chainId: boom }));
    expect(down.head).toBeNull();
    expect(down.chainId).toBeNull();
  });

  it("keeps working when individual contract reads fail, leaving those fields null", async () => {
    const s = await run(chain({ reads: { totalSupply: new Error("x"), name: new Error("x"), DOMAIN_SEPARATOR: new Error("x") } }));
    expect(s.verdict).toBe("live");
    expect(s.contract).toMatchObject({ name: null, totalSupplyWei: null, domainSeparatorOk: null, symbol: "MEV" });
  });

  it("flags a wrong EIP-712 domain separator", async () => {
    const s = await run(chain({ reads: { DOMAIN_SEPARATOR: domainOf(1) } }));
    expect(s.contract?.domainSeparatorOk).toBe(false);
  });

  it("flags an oracle or owner that no longer matches the deployment record (the owner can rotate the oracle)", async () => {
    const rotated = "0x00000000000000000000000000000000000000aa";
    const a = await run(chain({ reads: { azureOracleSigner: rotated } }));
    expect(a.verdict).toBe("live");
    expect(a.contract?.matchesDeploymentRecord).toBe(false);
    const b = await run(chain({ reads: { owner: rotated } }));
    expect(b.contract?.matchesDeploymentRecord).toBe(false);
  });

  it("compares addresses without caring about letter case", async () => {
    const s = await run(chain({ reads: { azureOracleSigner: PUBLISHED_ORACLE.toLowerCase(), owner: PUBLISHED_OWNER.toUpperCase().replace("0X", "0x") } }));
    expect(s.contract?.matchesDeploymentRecord).toBe(true);
  });

  it("only ever uses read calls, and reads the owner and the oracle signer by their real getter names", async () => {
    const seen: string[] = [];
    const probe = chain();
    await run({ ...probe, read: (fn) => (seen.push(fn), probe.read(fn)) });
    expect(seen.sort()).toEqual(["DOMAIN_SEPARATOR", "azureOracleSigner", "name", "owner", "symbol", "totalSupply"]);
  });
});
