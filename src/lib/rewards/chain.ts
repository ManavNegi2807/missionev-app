import type { ChainEvent, OnchainSnapshot } from "./types";

/**
 * Thin on-chain adapter for MissionEVRewards, driven through the connected wallet's EIP-1193 provider.
 * Everything here is a real RPC call; nothing returns a value unless the provider did.
 * ABI fragments are transcribed from MissionEVRewards.sol (enum TrustLevel is uint8 in the ABI).
 */
export type Req = (method: string, params?: unknown[]) => Promise<unknown>;

export const REWARD_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function redeem(uint256 _amount, string _rewardId)",
] as const;

const TRIP_RECORDED = "event TripRecorded(bytes32 indexed tripHash, address indexed user, uint256 vehicleId, uint256 distanceMeters, uint256 co2SavedGrams, uint256 tokensMinted, uint8 trust)";
const REDEEMED = "event Redeemed(address indexed user, uint256 amount, string rewardId)";

const hexToNum = (h: unknown) => (typeof h === "string" ? Number.parseInt(h, 16) : NaN);
const hexToBig = (h: unknown) => (typeof h === "string" && h.startsWith("0x") ? BigInt(h) : BigInt(0));

export async function readOnchain(req: Req, contract: string, rawUser: string): Promise<OnchainSnapshot> {
  const user = rawUser.toLowerCase();
  const { encodeFunctionData, decodeFunctionResult, parseAbi, toEventSelector, decodeEventLog, pad } = await import("viem");
  const abi = parseAbi(REWARD_ABI);

  const code = await req("eth_getCode", [contract, "latest"]);
  const hasCode = typeof code === "string" && code !== "0x" && code !== "0x0";
  const snap: OnchainSnapshot = { hasCode, balance: null, events: null, earned: null, redeemed: null, avoidedG: null, at: Date.now() };
  if (!hasCode) return snap;

  try {
    const data = encodeFunctionData({ abi, functionName: "balanceOf", args: [user as `0x${string}`] });
    const res = await req("eth_call", [{ to: contract, data }, "latest"]);
    snap.balance = Number(decodeFunctionResult({ abi, functionName: "balanceOf", data: res as `0x${string}` }));
  } catch {
    snap.balance = null;
  }
  try {
    const eventAbi = parseAbi([TRIP_RECORDED, REDEEMED]);
    const rewardTopic = toEventSelector(TRIP_RECORDED);
    const redeemTopic = toEventSelector(REDEEMED);
    const userTopic = pad(user as `0x${string}`);
    type Log = { data: `0x${string}`; topics: `0x${string}`[]; transactionHash: string; blockNumber: string; logIndex: string };
    const [rewardLogs, redeemLogs] = (await Promise.all([
      req("eth_getLogs", [{ address: contract, fromBlock: "0x0", toBlock: "latest", topics: [rewardTopic, null, userTopic] }]),
      req("eth_getLogs", [{ address: contract, fromBlock: "0x0", toBlock: "latest", topics: [redeemTopic, userTopic] }]),
    ])) as [Log[], Log[]];

    const events: ChainEvent[] = [];
    let earned = 0;
    let redeemed = 0;
    let avoided = 0;
    for (const l of rewardLogs) {
      const { args } = decodeEventLog({ abi: eventAbi, data: l.data, topics: l.topics as [`0x${string}`] }) as unknown as {
        args: { tokensMinted: bigint; co2SavedGrams: bigint };
      };
      earned += Number(args.tokensMinted);
      avoided += Number(args.co2SavedGrams);
      events.push({ id: `${l.transactionHash}:${l.logIndex}`, kind: "reward", amount: Number(args.tokensMinted), at: null, wallet: user, txHash: l.transactionHash, blockNumber: hexToNum(l.blockNumber), co2SavedGrams: Number(args.co2SavedGrams) });
    }
    for (const l of redeemLogs) {
      const { args } = decodeEventLog({ abi: eventAbi, data: l.data, topics: l.topics as [`0x${string}`] }) as unknown as {
        args: { amount: bigint; rewardId: string };
      };
      redeemed += Number(args.amount);
      events.push({ id: `${l.transactionHash}:${l.logIndex}`, kind: "redeem", amount: Number(args.amount), at: null, wallet: user, txHash: l.transactionHash, blockNumber: hexToNum(l.blockNumber), rewardId: args.rewardId });
    }

    // Block timestamps (newest 60 blocks only, to stay polite to the RPC).
    events.sort((a, b) => b.blockNumber - a.blockNumber);
    const blocks = [...new Set(events.map((e) => e.blockNumber))].slice(0, 60);
    const times = new Map<number, number>();
    await Promise.all(
      blocks.map(async (n) => {
        try {
          const b = (await req("eth_getBlockByNumber", [`0x${n.toString(16)}`, false])) as { timestamp?: string } | null;
          if (b?.timestamp) times.set(n, hexToNum(b.timestamp) * 1000);
        } catch {
          /* leave null */
        }
      }),
    );
    snap.events = events.map((e) => ({ ...e, at: times.get(e.blockNumber) ?? null }));
    snap.earned = earned;
    snap.redeemed = redeemed;
    snap.avoidedG = avoided;
  } catch (e) {
    snap.eventsError = e instanceof Error ? e.message : "Event history unavailable from this RPC.";
  }
  return snap;
}

/** Native (tPOT) balance in wei, straight from eth_getBalance. */
export async function readGas(req: Req, user: string): Promise<string> {
  return hexToBig(await req("eth_getBalance", [user, "latest"])).toString();
}

/** Ask the wallet to send redeem(amount, rewardId). The returned hash is whatever the wallet returned. */
export async function sendRedeem(req: Req, args: { from: string; contract: string; amount: number; rewardId: string }): Promise<string> {
  const { encodeFunctionData, parseAbi } = await import("viem");
  const data = encodeFunctionData({ abi: parseAbi(REWARD_ABI), functionName: "redeem", args: [BigInt(args.amount), args.rewardId] });
  const hash = await req("eth_sendTransaction", [{ from: args.from.toLowerCase(), to: args.contract, data }]);
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("The wallet did not return a transaction hash.");
  return hash;
}

export type Receipt = { status: "success" | "reverted"; blockNumber: number };

export async function getReceipt(req: Req, hash: string): Promise<Receipt | null> {
  const r = (await req("eth_getTransactionReceipt", [hash])) as { status?: string; blockNumber?: string } | null;
  if (!r || !r.status) return null;
  return { status: r.status === "0x1" ? "success" : "reverted", blockNumber: hexToNum(r.blockNumber) };
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

/** tPOT assumed to use 18 decimals like every EVM native currency; shown to 4 dp. */
export function formatNative(wei: string): string {
  const w = BigInt(wei);
  const base = BigInt("1000000000000000000");
  const whole = w / base;
  const frac = ((w % base) * BigInt(10000)) / base;
  return `${whole.toString()}.${frac.toString().padStart(4, "0")}`;
}
