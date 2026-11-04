import { createPublicClient, getAddress, hashDomain, http, type Hex } from "viem";
import { PORTAL_V3 } from "@/lib/chain";
import { portalChain } from "@/lib/contract/chain";
import { MISSIONEV_ABI } from "@/lib/contract/missionev.abi";
import { ORACLE_SIGNER_GETTER } from "@/lib/contract/names";
import { ageText } from "@/lib/landing/age";
import { DEPLOYED_CONTRACT, PUBLISHED_ORACLE, PUBLISHED_OWNER } from "@/lib/landing/facts";
import { readConfig } from "./config";

/**
 * A read-only snapshot of Portal V3 and the deployed contract, for the landing page's "ask the chain" panel. It only calls
 * `eth_chainId`, `eth_getBlockByNumber`, `eth_getCode` and `eth_call`: no key, no wallet, nothing is sent. The same rule as
 * `npm run network:health` decides when the endpoint counts as stale (tests/chain-status.test.ts keeps the two in step).
 */
export const MAX_HEAD_AGE_SEC = 120;

export type ChainVerdict = "live" | "stale" | "wrong-chain" | "no-contract" | "unreachable";

export interface ChainStatus {
  verdict: ChainVerdict;
  /** One plain sentence the page can show as is. */
  message: string;
  /** Unix milliseconds. */
  checkedAt: number;
  rpc: string;
  chainId: number | null;
  expectedChainId: number;
  head: { number: number; ageSeconds: number } | null;
  contract: {
    address: string;
    codeBytes: number;
    name: string | null;
    symbol: string | null;
    /** Total $MEV ever minted, in wei, as a decimal string (18 decimals). */
    totalSupplyWei: string | null;
    oracleSigner: string | null;
    owner: string | null;
    /** The chain's DOMAIN_SEPARATOR equals the EIP-712 domain recomputed for this chain and address. null = could not be read. */
    domainSeparatorOk: boolean | null;
    /** Owner and oracle signer equal the deployment record in the README. null = could not be read. */
    matchesDeploymentRecord: boolean | null;
  } | null;
}

/** The few node calls the status needs, so tests can supply a fake chain. */
export interface ChainProbe {
  chainId(): Promise<number>;
  head(): Promise<{ number: number; timestamp: number }>;
  /** "0x" when nothing is deployed there. */
  code(): Promise<string>;
  read(functionName: string): Promise<unknown>;
}

const same = (a: unknown, b: string) => typeof a === "string" && a.toLowerCase() === b.toLowerCase();
const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : null);

const expectedDomainSeparator = (chainId: number, address: Hex) =>
  hashDomain({
    domain: { name: "MissionEV", version: "1", chainId: BigInt(chainId), verifyingContract: getAddress(address) },
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
    },
  });

export async function evaluateChain(probe: ChainProbe, opts: { address: Hex; rpc: string; now?: number }): Promise<ChainStatus> {
  const now = opts.now ?? Date.now();
  const base = { checkedAt: now, rpc: opts.rpc, expectedChainId: PORTAL_V3.chainId };

  const [chainIdR, headR] = await Promise.allSettled([probe.chainId(), probe.head()]);
  if (chainIdR.status !== "fulfilled" || headR.status !== "fulfilled") {
    return { ...base, verdict: "unreachable", message: "The Portal V3 RPC did not answer in time. It is the public testnet endpoint, so try again in a moment.", chainId: null, head: null, contract: null };
  }
  const chainId = chainIdR.value;
  const ageSeconds = Math.max(0, Math.round(now / 1000 - headR.value.timestamp));
  const head = { number: headR.value.number, ageSeconds };
  if (chainId !== PORTAL_V3.chainId) {
    return { ...base, verdict: "wrong-chain", message: `The endpoint reports chain id ${chainId}, not ${PORTAL_V3.chainId}.`, chainId, head, contract: null };
  }

  const code = await probe.code().catch(() => null);
  if (code === null) return { ...base, verdict: "unreachable", message: "The chain answered, but reading the contract code failed. Try again in a moment.", chainId, head, contract: null };
  if (code === "0x" || code === "") {
    return { ...base, verdict: "no-contract", message: "The chain answered, but there is no contract code at the published address.", chainId, head, contract: null };
  }

  const [name, symbol, supply, oracle, owner, domain] = (await Promise.allSettled([
    probe.read("name"),
    probe.read("symbol"),
    probe.read("totalSupply"),
    probe.read(ORACLE_SIGNER_GETTER),
    probe.read("owner"),
    probe.read("DOMAIN_SEPARATOR"),
  ])).map(ok);
  const oracleSigner = typeof oracle === "string" ? oracle : null;
  const ownerAddr = typeof owner === "string" ? owner : null;

  const stale = ageSeconds > MAX_HEAD_AGE_SEC;
  return {
    ...base,
    verdict: stale ? "stale" : "live",
    message: stale
      ? `The newest block is ${ageText(ageSeconds)} old, so the endpoint may be lagging and the figures below could be out of date.`
      : "Portal V3 answered just now: the chain is moving and the contract is where the deployment record says it is.",
    chainId,
    head,
    contract: {
      address: opts.address,
      codeBytes: (code.length - 2) / 2,
      name: typeof name === "string" ? name : null,
      symbol: typeof symbol === "string" ? symbol : null,
      totalSupplyWei: typeof supply === "bigint" ? supply.toString() : null,
      oracleSigner,
      owner: ownerAddr,
      domainSeparatorOk: typeof domain === "string" ? domain.toLowerCase() === expectedDomainSeparator(chainId, opts.address).toLowerCase() : null,
      matchesDeploymentRecord: oracleSigner && ownerAddr ? same(oracleSigner, PUBLISHED_ORACLE) && same(ownerAddr, PUBLISHED_OWNER) : null,
    },
  };
}

function createProbe(rpc: string, address: Hex): ChainProbe {
  const client = createPublicClient({ chain: portalChain(rpc), transport: http(rpc, { timeout: 6_000, retryCount: 0 }) });
  return {
    chainId: () => client.getChainId(),
    async head() {
      const b = await client.getBlock({ blockTag: "latest" });
      return { number: Number(b.number), timestamp: Number(b.timestamp) };
    },
    async code() {
      return (await client.getCode({ address })) ?? "0x";
    },
    read: (functionName) => client.readContract({ address, abi: MISSIONEV_ABI, functionName: functionName as never }),
  };
}

/* The public RPC is shared, so results are cached briefly and concurrent visitors share one lookup. */
const TTL_MS = 15_000;
const FAIL_TTL_MS = 4_000;
let cache: { at: number; ttl: number; value: ChainStatus } | null = null;
let inflight: Promise<ChainStatus> | null = null;

export async function getChainStatus(): Promise<ChainStatus> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.value;
  inflight ??= (async () => {
    try {
      // Env settings win; with none the site still reads the public deployment, which is what the panel is for.
      const cfg = readConfig();
      const rpc = cfg.rpcUrl ?? PORTAL_V3.rpcUrl;
      const address = (cfg.contract ?? DEPLOYED_CONTRACT) as Hex;
      const value = await evaluateChain(createProbe(rpc, address), { address, rpc });
      cache = { at: Date.now(), ttl: value.verdict === "unreachable" ? FAIL_TTL_MS : TTL_MS, value };
      return value;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
