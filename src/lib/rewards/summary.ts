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
  redeemed: number;
  pending: number;
  cleanJourneys: number;
  successfulRedemptions: number;
  avoidedG: number;
  recordedJourneys: number;
  /** Illustrative events derived from local trips / demo top-ups. */
  events: RewardEvent[];
  lastEvent: { label: string; amount: number; at: number | null; real: boolean } | null;
}

const isRecorded = (t: TripRecord) => t.ledger.phase === "previewed" || t.ledger.phase === "confirmed";

/**
 * Single source of truth for every reward number on the screen.
 *
 * DEMO mode: a verified trip's tokens become available once its on-chain record has been *previewed*
 * on Screen 02 (nothing is minted). Verified-but-unrecorded trips are "pending". Demo top-ups are
 * available immediately. Only simulated redemptions reduce the balance.
 *
 * ON-CHAIN mode: balance / earned / redeemed / avoided CO₂ come from contract reads; trips that
 * haven't been recorded remain "pending".
 */
export function summarize(input: {
  trips: TripRecord[];
  grants: DemoGrant[];
  redemptions: RedemptionRecord[];
  onchain: OnchainSnapshot | null;
}): RewardSummary {
  const verified = input.trips.filter((t) => t.status === "VERIFIED" && t.emissions);
  const recorded = verified.filter(isRecorded);
  const unrecorded = verified.filter((t) => !isRecorded(t));
  const succeeded = input.redemptions.filter((r) => r.status === "completed" || r.status === "simulated");

  const events: RewardEvent[] = [
    ...recorded.map<RewardEvent>((t) => ({
      id: t.id,
      kind: "trip",
      at: t.endedAt,
      amount: t.emissions!.tokens,
      label: `Trip reward · ${t.routeName ?? "GPS trip"}`,
      status: "Previewed record (illustrative)",
      tripId: t.id,
    })),
    ...unrecorded.map<RewardEvent>((t) => ({
      id: t.id,
      kind: "trip",
      at: t.endedAt,
      amount: t.emissions!.tokens,
      label: `Trip reward · ${t.routeName ?? "GPS trip"}`,
      status: "Pending — not recorded yet",
      tripId: t.id,
    })),
    ...input.grants.map<RewardEvent>((g) => ({ id: g.id, kind: "grant", at: g.at, amount: g.amount, label: "Demo top-up", status: "Local demo credit" })),
  ].sort((a, b) => b.at - a.at);

  const pending = unrecorded.reduce((n, t) => n + t.emissions!.tokens, 0);
  const base = {
    cleanJourneys: verified.length,
    successfulRedemptions: succeeded.length,
    pending,
    recordedJourneys: recorded.length,
    events,
  };

  if (input.onchain && input.onchain.balance !== null) {
    const o = input.onchain;
    const lastChain = o.events?.find((e) => e.kind === "reward") ?? null;
    // Reserve tokens committed to a redeem() transaction that hasn't confirmed yet.
    const reserved = input.redemptions.filter((r) => r.mode === "onchain" && r.status === "pending").reduce((n, r) => n + r.amount, 0);
    return {
      ...base,
      mode: "onchain",
      balance: Math.max(0, (o.balance ?? 0) - reserved),
      earned: o.earned ?? 0,
      redeemed: o.redeemed ?? 0,
      avoidedG: o.avoidedG ?? 0,
      lastEvent: lastChain ? { label: "On-chain reward", amount: lastChain.amount, at: lastChain.at, real: true } : null,
    };
  }

  const credited = recorded.reduce((n, t) => n + t.emissions!.tokens, 0) + input.grants.reduce((n, g) => n + g.amount, 0);
  const redeemed = input.redemptions.filter((r) => r.status === "simulated").reduce((n, r) => n + r.amount, 0);
  const lastCredited = events.find((e) => e.status !== "Pending — not recorded yet") ?? null;
  return {
    ...base,
    mode: "demo",
    balance: Math.max(0, credited - redeemed),
    earned: credited,
    redeemed,
    // Same definition as Screen 04: estimated avoided emissions of every verified journey (Journey Lab rule).
    avoidedG: verified.reduce((n, t) => n + (t.emissions?.savedG ?? 0), 0),
    lastEvent: lastCredited ? { label: lastCredited.label, amount: lastCredited.amount, at: lastCredited.at, real: false } : null,
  };
}
