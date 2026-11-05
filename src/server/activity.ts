import { createPublicClient, http, parseAbiItem, zeroAddress, type Hex } from "viem";
import { transportModeName } from "@/lib/carbon/contractMapping";
import { PORTAL_V3 } from "@/lib/chain";
import { portalChain } from "@/lib/contract/chain";
import { DEPLOYED_CONTRACT, DEPLOY_TX } from "@/lib/landing/facts";
import { readConfig } from "./config";

/**
 * "Recent on-chain activity": the latest `CommuteVerified` events (one per successful `recordCommute`) read straight from the
 * deployed contract's logs. Read-only: no key, no wallet, nothing is sent. Nothing is shown unless it was read from the chain,
 * and an empty chain or a failing RPC is reported as exactly that.
 */
export const ACTIVITY_LIMIT = 10;
const CHUNK = 50_000;
const MAX_CHUNKS = 8;
const SMALL_CHUNK = 5_000;
const SMALL_MAX_CHUNKS = 6;
/** The indexer link used when no explorer URL is configured. */
export const INDEXER_TX_URL = "https://portalindex-98f0.onrender.com/evm_transactions?tx_hash=eq.";

export const COMMUTE_EVENT = parseAbiItem("event CommuteVerified(address indexed commuter, bytes32 indexed tripId, uint8 mode, uint32 distanceMeters, uint32 co2AvoidedGrams, uint256 pointsMinted, uint256 newCarbonScore)");
export const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export interface ActivityEvent {
  txHash: string;
  blockNumber: number;
  logIndex: number;
  commuter: string;
  tripId: string;
  mode: number;
  modeName: string;
  distanceMeters: number;
  co2AvoidedGrams: number;
  /** Exact $MEV minted in that transaction (wei, decimal string), from the mint `Transfer`; null if it couldn't be read. */
  mintedWei: string | null;
  /** Block time in unix seconds; null if it couldn't be read. */
  timestamp: number | null;
  /** A link a person can open to inspect the transaction. */
  url: string;
}

export type ActivityVerdict = "ok" | "empty" | "unreachable";

export interface ActivityResult {
  verdict: ActivityVerdict;
  /** One plain sentence the page can show as is. */
  message: string;
  checkedAt: number;
  events: ActivityEvent[];
  /** Where the search started; events older than this (if any) are not shown. */
  fromBlock: number | null;
  head: number | null;
  /** Whether the whole history since deployment was searched. */
  complete: boolean;
  linkKind: "explorer" | "indexer";
}

export interface RawCommute {
  txHash: string;
  blockNumber: number;
  logIndex: number;
  commuter: string;
  tripId: string;
  mode: number;
  distanceMeters: number;
  co2AvoidedGrams: number;
}
export interface RawMint { txHash: string; to: string; value: bigint }

/** The few node calls the panel needs, so tests can supply a fake chain. */
export interface ActivityProbe {
  head(): Promise<number>;
  commutes(from: number, to: number): Promise<RawCommute[]>;
  mints(from: number, to: number): Promise<RawMint[]>;
  blockTime(n: number): Promise<number | null>;
}

export const txLink = (hash: string, explorerUrl: string = PORTAL_V3.explorerUrl) => (explorerUrl ? `${explorerUrl.replace(/\/$/, "")}/tx/${hash}` : `${INDEXER_TX_URL}${hash}`);

type Chunk = { from: number; to: number };
function chunksBack(head: number, floor: number, size: number, max: number): Chunk[] {
  const out: Chunk[] = [];
  for (let to = head; to >= floor && out.length < max; to -= size) out.push({ from: Math.max(floor, to - size + 1), to });
  return out;
}

export async function evaluateActivity(probe: ActivityProbe, opts: { floor?: number; limit?: number; now?: number; explorerUrl?: string } = {}): Promise<ActivityResult> {
  const now = opts.now ?? Date.now();
  const limit = opts.limit ?? ACTIVITY_LIMIT;
  const floor = Math.max(0, opts.floor ?? 0);
  const linkKind = (opts.explorerUrl ?? PORTAL_V3.explorerUrl) ? "explorer" : "indexer";
  const fail = (message: string): ActivityResult => ({ verdict: "unreachable", message, checkedAt: now, events: [], fromBlock: null, head: null, complete: false, linkKind });

  let head: number;
  try {
    head = await probe.head();
  } catch {
    return fail("The Portal V3 RPC did not answer in time, so recent activity can't be shown. It is the public testnet endpoint: try again in a moment.");
  }

  /* Search newest-first in windows, in parallel. A public RPC may cap the log range, so retry once with smaller windows. */
  const attempt = async (size: number, max: number) => {
    const chunks = chunksBack(head, floor, size, max);
    const results = await Promise.allSettled(chunks.map((c) => probe.commutes(c.from, c.to)));
    return { chunks, results };
  };
  let { chunks, results } = await attempt(CHUNK, MAX_CHUNKS);
  if (results.every((r) => r.status === "rejected")) ({ chunks, results } = await attempt(SMALL_CHUNK, SMALL_MAX_CHUNKS));
  if (results.every((r) => r.status === "rejected")) return fail("The chain answered, but reading the contract's event logs failed (the public RPC may limit log queries). Try again in a moment.");

  const answered = chunks.filter((_, i) => results[i].status === "fulfilled");
  const raw = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const oldestAnswered = Math.min(...answered.map((c) => c.from));
  const lowest = chunks[chunks.length - 1].from;
  // Every window answered and the oldest reached the floor: the whole history since deployment was searched.
  const complete = answered.length === chunks.length && lowest <= floor;
  const fromBlock = oldestAnswered;

  raw.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
  const seen = new Set<string>();
  const latest = raw.filter((e) => (seen.has(`${e.txHash}:${e.logIndex}`) ? false : (seen.add(`${e.txHash}:${e.logIndex}`), true))).slice(0, limit);

  if (latest.length === 0) {
    return {
      verdict: "empty",
      message: complete
        ? "The contract has no recordCommute transactions yet: the chain was searched from deployment to the latest block and found none."
        : `No recordCommute transactions were found in blocks ${fromBlock.toLocaleString("en-US")} to ${head.toLocaleString("en-US")}, the part of the chain that could be searched just now.`,
      checkedAt: now,
      events: [],
      fromBlock,
      head,
      complete,
      linkKind,
    };
  }

  /* Exact minted amounts (the event's own figure is truncated to whole tokens) and block times, for just the rows shown. */
  const blocks = [...new Set(latest.map((e) => e.blockNumber))];
  const lo = Math.min(...blocks);
  const hi = Math.max(...blocks);
  const [mintsR, ...times] = await Promise.allSettled([probe.mints(lo, hi), ...blocks.map((b) => probe.blockTime(b))]);
  const mints = mintsR.status === "fulfilled" ? mintsR.value : null;
  const timeOf = new Map<number, number | null>(blocks.map((b, i) => [b, times[i].status === "fulfilled" ? (times[i] as PromiseFulfilledResult<number | null>).value : null]));

  const events: ActivityEvent[] = latest.map((e) => {
    const minted = mints ? mints.filter((m) => m.txHash === e.txHash && m.to.toLowerCase() === e.commuter.toLowerCase()).reduce((s, m) => s + m.value, BigInt(0)) : null;
    return {
      ...e,
      modeName: transportModeName(e.mode) ?? "UNKNOWN",
      mintedWei: minted === null ? null : minted.toString(),
      timestamp: timeOf.get(e.blockNumber) ?? null,
      url: txLink(e.txHash, opts.explorerUrl),
    };
  });
  return {
    verdict: "ok",
    message: `Read from the contract's event logs just now: the latest ${events.length} recordCommute transaction${events.length === 1 ? "" : "s"}.`,
    checkedAt: now,
    events,
    fromBlock,
    head,
    complete,
    linkKind,
  };
}

function createProbe(rpc: string, address: Hex): ActivityProbe {
  const client = createPublicClient({ chain: portalChain(rpc), transport: http(rpc, { timeout: 8_000, retryCount: 0 }) });
  return {
    head: async () => Number(await client.getBlockNumber()),
    async commutes(from, to) {
      const logs = await client.getLogs({ address, event: COMMUTE_EVENT, fromBlock: BigInt(from), toBlock: BigInt(to) });
      return logs.flatMap((l) =>
        l.transactionHash && l.blockNumber !== null && l.logIndex !== null && l.args.commuter && l.args.tripId
          ? [{ txHash: l.transactionHash, blockNumber: Number(l.blockNumber), logIndex: l.logIndex, commuter: l.args.commuter, tripId: l.args.tripId, mode: Number(l.args.mode), distanceMeters: Number(l.args.distanceMeters), co2AvoidedGrams: Number(l.args.co2AvoidedGrams) }]
          : [],
      );
    },
    async mints(from, to) {
      const logs = await client.getLogs({ address, event: TRANSFER_EVENT, args: { from: zeroAddress }, fromBlock: BigInt(from), toBlock: BigInt(to) });
      return logs.flatMap((l) => (l.transactionHash && l.args.to && typeof l.args.value === "bigint" ? [{ txHash: l.transactionHash, to: l.args.to, value: l.args.value }] : []));
    },
    async blockTime(n) {
      return Number((await client.getBlock({ blockNumber: BigInt(n) })).timestamp);
    },
  };
}

/** The block the published deployment was mined in, so an empty chain can honestly say "searched since deployment". */
let deployBlock: { rpc: string; block: number } | null = null;
async function deploymentFloor(rpc: string, address: string): Promise<number> {
  if (address.toLowerCase() !== DEPLOYED_CONTRACT.toLowerCase()) return 0;
  if (deployBlock?.rpc === rpc) return deployBlock.block;
  try {
    const client = createPublicClient({ chain: portalChain(rpc), transport: http(rpc, { timeout: 6_000, retryCount: 0 }) });
    const r = await client.getTransactionReceipt({ hash: DEPLOY_TX as Hex });
    deployBlock = { rpc, block: Number(r.blockNumber) };
    return deployBlock.block;
  } catch {
    return 0;
  }
}

/* The public RPC is shared, so results are cached briefly and concurrent visitors share one lookup (same pattern as /api/chain). */
const TTL_MS = 15_000;
const FAIL_TTL_MS = 4_000;
let cache: { at: number; ttl: number; value: ActivityResult } | null = null;
let inflight: Promise<ActivityResult> | null = null;

export async function getRecentActivity(): Promise<ActivityResult> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.value;
  inflight ??= (async () => {
    try {
      const cfg = readConfig();
      const rpc = cfg.rpcUrl ?? PORTAL_V3.rpcUrl;
      const address = (cfg.contract ?? DEPLOYED_CONTRACT) as Hex;
      const floor = await deploymentFloor(rpc, address);
      const value = await evaluateActivity(createProbe(rpc, address), { floor });
      cache = { at: Date.now(), ttl: value.verdict === "unreachable" ? FAIL_TTL_MS : TTL_MS, value };
      return value;
    } catch {
      // Never let an unexpected error become a 500 page: say what happened.
      const value: ActivityResult = { verdict: "unreachable", message: "Recent activity couldn't be read just now. Try again in a moment.", checkedAt: Date.now(), events: [], fromBlock: null, head: null, complete: false, linkKind: PORTAL_V3.explorerUrl ? "explorer" : "indexer" };
      cache = { at: Date.now(), ttl: FAIL_TTL_MS, value };
      return value;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
