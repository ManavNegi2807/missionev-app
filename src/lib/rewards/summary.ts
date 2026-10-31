import { mevNumber } from "@/lib/contract/client";
import type { TripRecord } from "@/lib/trip/types";
import type { OnchainSnapshot, RedemptionRecord, RewardEvent } from "./types";

export interface DemoGrant {
  id: string;
  amount: number;
  at: number;
}

export interface RewardSummary {
  mode: "demo" | "onchain";
  balance: number;
  earned: number;
  /** Simulated redemptions (D4). The contract has no redeem, so these never move tokens. */
  redeemed: number;
  /** On-chain mode only: tokens sent to other addresses with `transfer`. */
  transferredOut: number;
  pending: number;
  cleanJourneys: number;
  successfulRedemptions: number;
  avoidedG: number;
  recordedJourneys: number;
  /** Events derived from local trips / demo top-ups. */
  events: RewardEvent[];
  lastEvent: { label: string; amount: number; at: number | null; real: boolean } | null;
}

/** A trip counts as credited once it's demo-credited or its commute is confirmed on-chain. */
const isRecorded = (t: TripRecord) => t.settlement.phase === "demo-credited" || t.settlement.phase === "confirmed";
const previewOf = (t: TripRecord) => t.settlement.preview?.rewardMev ?? 0;
const tripLabel = (t: TripRecord) => `Trip reward · ${t.routeName ?? "GPS trip"}`;

/**
 * Single source of truth for every reward number on the screen.
 *
 * DEMO mode: a verified, eligible trip's tokens become available once the commuter credits it in the demo (nothing is
 * minted and no transaction exists). Verified-but-uncredited trips are "pending". Demo top-ups are available immediately.
 *
 * ON-CHAIN mode: balance and earned come from contract reads (`balanceOf`, Transfer events). Trips whose commute hasn't
 * been confirmed remain "pending". Redemptions stay simulated, so their cost is subtracted from the displayed balance
 * without touching the chain.
 */
export function summarize(input: {
  trips: TripRecord[];
  grants: DemoGrant[];
  redemptions: RedemptionRecord[];
  onchain: OnchainSnapshot | null;
}): RewardSummary {
  const rewardable = input.trips.filter((t) => t.status === "VERIFIED" && t.carbon?.reward.eligible);
  const verified = input.trips.filter((t) => t.status === "VERIFIED" && t.carbon);
  const live = input.onchain !== null && input.onchain.balance !== null;
  // Which trips are "recorded" depends on the mode: on-chain, only confirmed commutes; in the demo, only demo-credited ones.
  const done = (t: TripRecord) => (live ? t.settlement.phase === "confirmed" : t.settlement.phase === "demo-credited");
  const recorded = rewardable.filter(done);
  const unrecorded = rewardable.filter((t) => !isRecorded(t));
  const succeeded = input.redemptions.filter((r) => r.status === "simulated");
  const simulatedSpend = succeeded.reduce((n, r) => n + r.amount, 0);

  const events: RewardEvent[] = [
    ...recorded.map<RewardEvent>((t) => ({
      id: t.id,
      kind: "trip",
      at: t.endedAt,
      amount: t.settlement.demo?.creditedMev ?? (t.settlement.onchain ? mevNumber(t.settlement.onchain.mintedWei) : 0),
      label: tripLabel(t),
      status: live ? "Confirmed on-chain" : "Demo credit (nothing minted)",
      tripId: t.id,
    })),
    ...unrecorded.map<RewardEvent>((t) => ({ id: t.id, kind: "trip", at: t.endedAt, amount: previewOf(t), label: tripLabel(t), status: "Pending — not recorded yet", tripId: t.id })),
    ...(live ? [] : input.grants.map<RewardEvent>((g) => ({ id: g.id, kind: "grant", at: g.at, amount: g.amount, label: "Demo top-up", status: "Local demo credit" }))),
  ].sort((a, b) => b.at - a.at);

  const base = {
    cleanJourneys: verified.length,
    successfulRedemptions: succeeded.length,
    pending: unrecorded.reduce((n, t) => n + previewOf(t), 0),
    recordedJourneys: recorded.length,
    events,
  };

  if (live) {
    const o = input.onchain!;
    const lastChain = o.events?.find((e) => e.kind === "reward") ?? null;
    return {
      ...base,
      mode: "onchain",
      balance: Math.max(0, (o.balance ?? 0) - simulatedSpend),
      earned: o.earned ?? 0,
      redeemed: simulatedSpend,
      transferredOut: o.transferredOut ?? 0,
      avoidedG: o.avoidedG ?? 0,
      lastEvent: lastChain ? { label: "On-chain reward", amount: lastChain.amount, at: lastChain.at, real: true } : null,
    };
  }

  const credited = recorded.reduce((n, t) => n + (t.settlement.demo?.creditedMev ?? 0), 0) + input.grants.reduce((n, g) => n + g.amount, 0);
  const lastCredited = events.find((e) => e.status !== "Pending — not recorded yet") ?? null;
  return {
    ...base,
    mode: "demo",
    balance: Math.max(0, credited - simulatedSpend),
    earned: credited,
    redeemed: simulatedSpend,
    transferredOut: 0,
    // Same definition as Screen 04: estimated avoided emissions of every verified journey.
    avoidedG: verified.reduce((n, t) => n + (t.carbon?.co2AvoidedGrams ?? 0), 0),
    lastEvent: lastCredited ? { label: lastCredited.label, amount: lastCredited.amount, at: lastCredited.at, real: false } : null,
  };
}
