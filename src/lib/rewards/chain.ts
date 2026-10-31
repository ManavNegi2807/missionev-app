import { decodeEventLog, formatUnits, pad, toEventSelector, type Hex } from "viem";
import { MISSIONEV_ABI } from "@/lib/contract/missionev.abi";
import { readCommuterOnChain, type Req } from "@/lib/contract/client";
import type { ChainEvent, OnchainSnapshot } from "./types";

export { formatNative, getReceipt, readGas, waitForReceipt, type Req } from "@/lib/contract/client";

const ZERO_TOPIC = pad("0x0");
const TRANSFER = toEventSelector("Transfer(address,address,uint256)");
const COMMUTE = toEventSelector("CommuteVerified(address,bytes32,uint8,uint32,uint32,uint256,uint256)");
const hexToNum = (h: unknown) => (typeof h === "string" ? Number.parseInt(h, 16) : NaN);
const mev = (wei: bigint) => Number(formatUnits(wei, 18));

type Log = { data: Hex; topics: Hex[]; transactionHash: string; blockNumber: string; logIndex: string };

/**
 * Reads the connected commuter's real state from the MissionEV contract through their wallet: `balanceOf`, `getCommuter`
 * and the Transfer / CommuteVerified events. A value is reported only if the provider returned it.
 */
export async function readOnchain(req: Req, contract: string, rawUser: string): Promise<OnchainSnapshot> {
  const user = rawUser.toLowerCase() as Hex;
  const code = await req("eth_getCode", [contract, "latest"]);
  const hasCode = typeof code === "string" && code !== "0x" && code !== "0x0";
  const snap: OnchainSnapshot = { hasCode, balance: null, balanceWei: null, commuter: null, events: null, earned: null, transferredOut: null, avoidedG: null, at: Date.now() };
  if (!hasCode) return snap;

  try {
    const c = await readCommuterOnChain(req, contract as Hex, user);
    snap.balance = mev(c.balanceWei);
    snap.balanceWei = c.balanceWei.toString();
    snap.commuter = { carbonScore: c.carbonScore, streakDays: c.streakDays, lastTripTimestamp: c.lastTripTimestamp, totalAvoidedGramsCO2: c.totalAvoidedGramsCO2, totalTripsLogged: c.totalTripsLogged };
    snap.avoidedG = c.totalAvoidedGramsCO2;
  } catch {
    return snap; // balance stays null: never invent one
  }

  try {
    const userTopic = pad(user);
    const [incoming, outgoing, commutes] = (await Promise.all([
      req("eth_getLogs", [{ address: contract, fromBlock: "0x0", toBlock: "latest", topics: [TRANSFER, null, userTopic] }]),
      req("eth_getLogs", [{ address: contract, fromBlock: "0x0", toBlock: "latest", topics: [TRANSFER, userTopic] }]),
      req("eth_getLogs", [{ address: contract, fromBlock: "0x0", toBlock: "latest", topics: [COMMUTE, userTopic] }]),
    ])) as [Log[], Log[], Log[]];

    const trips = new Map<string, { co2: number; tripId: string }>();
    for (const l of commutes) {
      const ev = decodeEventLog({ abi: MISSIONEV_ABI, data: l.data, topics: l.topics as [Hex, ...Hex[]] });
      if (ev.eventName === "CommuteVerified") trips.set(l.transactionHash, { co2: ev.args.co2AvoidedGrams, tripId: ev.args.tripId });
    }

    const events: ChainEvent[] = [];
    let earned = BigInt(0);
    let out = BigInt(0);
    const seen = new Set<string>();
    for (const l of [...incoming, ...outgoing]) {
      const id = `${l.transactionHash}:${l.logIndex}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const ev = decodeEventLog({ abi: MISSIONEV_ABI, data: l.data, topics: l.topics as [Hex, ...Hex[]] });
      if (ev.eventName !== "Transfer") continue;
      const minted = l.topics[1] === ZERO_TOPIC;
      const sent = ev.args.from.toLowerCase() === user && !minted;
      if (minted) earned += ev.args.value;
      if (sent) out += ev.args.value;
      const trip = minted ? trips.get(l.transactionHash) : undefined;
      events.push({ id, kind: minted ? "reward" : sent ? "transfer-out" : "transfer-in", amount: mev(ev.args.value), amountWei: ev.args.value.toString(), at: null, wallet: user, txHash: l.transactionHash, blockNumber: hexToNum(l.blockNumber), co2SavedGrams: trip?.co2, tripId: trip?.tripId });
    }

    // Block timestamps (newest 60 blocks only, to stay polite to the RPC).
    events.sort((a, b) => b.blockNumber - a.blockNumber);
    const times = new Map<number, number>();
    await Promise.all(
      [...new Set(events.map((e) => e.blockNumber))].slice(0, 60).map(async (n) => {
        try {
          const b = (await req("eth_getBlockByNumber", [`0x${n.toString(16)}`, false])) as { timestamp?: string } | null;
          if (b?.timestamp) times.set(n, hexToNum(b.timestamp) * 1000);
        } catch {
          /* leave null */
        }
      }),
    );
    snap.events = events.map((e) => ({ ...e, at: times.get(e.blockNumber) ?? null }));
    snap.earned = mev(earned);
    snap.transferredOut = mev(out);
  } catch (e) {
    snap.eventsError = e instanceof Error ? e.message : "Event history unavailable from this RPC.";
  }
  return snap;
}
