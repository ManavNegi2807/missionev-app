import { decodeEventLog, decodeFunctionResult, encodeFunctionData, formatUnits, type Hex } from "viem";
import { MISSIONEV_ABI } from "./missionev.abi";

/**
 * Browser-side contract access through the connected wallet's EIP-1193 provider. Everything here is a real RPC call; nothing
 * returns a value the provider didn't. Writes are sent by the COMMUTER's wallet: `recordCommute` derives the commuter from
 * msg.sender, so the oracle can sign a trip but can never submit it.
 */
export type Req = (method: string, params?: unknown[]) => Promise<unknown>;

const ZERO = "0x0000000000000000000000000000000000000000";
const hexToNum = (h: unknown) => (typeof h === "string" ? Number.parseInt(h, 16) : NaN);

export interface CommuterOnChain {
  carbonScore: number;
  streakDays: number;
  lastTripTimestamp: number;
  totalAvoidedGramsCO2: number;
  totalTripsLogged: number;
  balanceWei: bigint;
}

export async function readCommuterOnChain(req: Req, contract: Hex, user: Hex): Promise<CommuterOnChain> {
  const data = encodeFunctionData({ abi: MISSIONEV_ABI, functionName: "getCommuter", args: [user] });
  const res = (await req("eth_call", [{ to: contract, data }, "latest"])) as Hex;
  const [carbonScore, streakDays, lastTripTimestamp, totalAvoidedGramsCO2, totalTripsLogged, balanceWei] = decodeFunctionResult({ abi: MISSIONEV_ABI, functionName: "getCommuter", data: res });
  return { carbonScore: Number(carbonScore), streakDays: Number(streakDays), lastTripTimestamp: Number(lastTripTimestamp), totalAvoidedGramsCO2: Number(totalAvoidedGramsCO2), totalTripsLogged: Number(totalTripsLogged), balanceWei };
}

export async function readNonce(req: Req, contract: Hex, user: Hex): Promise<bigint> {
  const data = encodeFunctionData({ abi: MISSIONEV_ABI, functionName: "nonces", args: [user] });
  return decodeFunctionResult({ abi: MISSIONEV_ABI, functionName: "nonces", data: (await req("eth_call", [{ to: contract, data }, "latest"])) as Hex });
}

export interface SignedForSubmit {
  tripId: string;
  mode: number;
  distanceMeters: number;
  co2AvoidedGrams: number;
  deadline: number;
  signature: string;
}

/** The exact calldata of `recordCommute(tripId, mode, distanceMeters, co2AvoidedGrams, deadline, sig)`. */
export const encodeRecordCommute = (s: SignedForSubmit): Hex =>
  encodeFunctionData({ abi: MISSIONEV_ABI, functionName: "recordCommute", args: [s.tripId as Hex, s.mode, s.distanceMeters, s.co2AvoidedGrams, BigInt(s.deadline), s.signature as Hex] });

/** Asks the wallet to send `recordCommute`. The hash returned is whatever the wallet returned; a rejection throws. */
export async function sendRecordCommute(req: Req, args: { from: string; contract: string; signed: SignedForSubmit }): Promise<string> {
  const hash = await req("eth_sendTransaction", [{ from: args.from.toLowerCase(), to: args.contract, data: encodeRecordCommute(args.signed) }]);
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("The wallet did not return a transaction hash.");
  return hash;
}

export interface Receipt {
  status: "success" | "reverted";
  blockNumber: number;
  logs: Array<{ address: string; topics: Hex[]; data: Hex }>;
}

export async function getReceipt(req: Req, hash: string): Promise<Receipt | null> {
  const r = (await req("eth_getTransactionReceipt", [hash])) as { status?: string; blockNumber?: string; logs?: Receipt["logs"] } | null;
  if (!r || !r.status) return null;
  return { status: r.status === "0x1" ? "success" : "reverted", blockNumber: hexToNum(r.blockNumber), logs: r.logs ?? [] };
}

export async function waitForReceipt(req: Req, hash: string, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<Receipt | null> {
  const deadline = Date.now() + (opts.timeoutMs ?? 120_000);
  while (Date.now() < deadline) {
    const r = await getReceipt(req, hash).catch(() => null);
    if (r) return r;
    await new Promise((res) => setTimeout(res, opts.intervalMs ?? 2000));
  }
  return null;
}

/** Exact $MEV minted to `user` in this receipt: the sum of `Transfer(0x0 → user)` values (the event's pointsMinted is truncated). */
export function mintedInReceipt(receipt: Receipt, contract: string, user: string): bigint {
  let total = BigInt(0);
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contract.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: MISSIONEV_ABI, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      if (ev.eventName === "Transfer" && ev.args.from === ZERO && ev.args.to.toLowerCase() === user.toLowerCase()) total += ev.args.value;
    } catch {
      /* not a MissionEV event */
    }
  }
  return total;
}

/** Native (tPOT) balance in wei, straight from eth_getBalance. A different currency from $MEV. */
export async function readGas(req: Req, user: string): Promise<string> {
  const h = await req("eth_getBalance", [user, "latest"]);
  return typeof h === "string" && h.startsWith("0x") ? BigInt(h).toString() : "0";
}

/** 18-decimal wei → a number for display (floats are fine for display, never for arithmetic on balances). */
export const mevNumber = (wei: bigint | string) => Number(formatUnits(BigInt(wei), 18));
export const formatMevWei = (wei: bigint | string, dp = 2) => {
  const n = mevNumber(wei);
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

/** tPOT assumed to use 18 decimals like every EVM native currency; shown to 4 dp. */
export function formatNative(wei: string): string {
  const w = BigInt(wei);
  const base = BigInt("1000000000000000000");
  return `${(w / base).toString()}.${(((w % base) * BigInt(10000)) / base).toString().padStart(4, "0")}`;
}
