import type { ChainEvent, RedemptionRecord, RewardEvent } from "@/lib/rewards/types";
import type { TripRecord } from "@/lib/trip/types";
import { COVERAGE_DAYS, generateDemo } from "./demo-data";
import { modeFromVehicle } from "./modes";
import { addDays, dayStart } from "./time";
import type { AnalyticsDataset, Commuter, Journey, RewardFact } from "./types";

export const YOU: Commuter = { key: "you", alias: "You", archetype: "This browser session", isYou: true, isDemo: false };

const recorded = (t: TripRecord) => t.ledger.phase === "previewed" || t.ledger.phase === "confirmed";

/** D2 → analytics. Same fields Screen 02 / 03 read, so totals reconcile exactly. */
export function journeyFromTrip(t: TripRecord): Journey {
  const verified = t.status === "VERIFIED" && !!t.emissions;
  const e = verified ? t.emissions! : null;
  return {
    id: t.id,
    day: dayStart(t.endedAt),
    userKey: YOU.key,
    mode: modeFromVehicle(t.vehicle.category, t.vehicle.fuel),
    distanceKm: t.distanceKm,
    baselineG: e?.baselineG ?? 0,
    actualG: e?.estimatedG ?? 0,
    avoidedG: e?.savedG ?? 0,
    verified,
    tokens: e?.tokens ?? 0,
    origin: "session",
    simulated: t.isSimulated,
  };
}

export interface DatasetInput {
  today: number;
  trips: TripRecord[];
  /** Screen 03's local reward events (only "grant" kinds are used here; trip rewards come from the trips themselves). */
  rewardEvents: RewardEvent[];
  redemptions: RedemptionRecord[];
  /** Real contract events, only when a deployed contract was read through a real wallet. */
  chainEvents: ChainEvent[] | null;
  /** When the contract snapshot was actually read. */
  chainAt: number | null;
  registeredAt: number | null;
}

export function buildDataset(input: DatasetInput): AnalyticsDataset {
  const { today } = input;
  const demo = generateDemo(today);

  const mine = input.trips.filter((t) => t.endedAt && dayStart(t.endedAt) <= today);
  const youJourneys = mine.map(journeyFromTrip);
  const onchain = input.chainEvents !== null;

  const youRewards: RewardFact[] = [];
  if (onchain) {
    // Real events replace the local approximation of this wallet's rewards.
    for (const e of input.chainEvents!) {
      if (e.at === null) continue;
      youRewards.push({ id: e.id, day: dayStart(e.at), userKey: YOU.key, kind: e.kind === "reward" ? "earned" : "redeemed", amount: e.amount, origin: "onchain", label: e.kind === "redeem" ? e.rewardId : undefined });
    }
  } else {
    for (const t of mine) {
      if (t.status !== "VERIFIED" || !t.emissions || t.emissions.tokens <= 0) continue;
      youRewards.push({
        id: `${t.id}-r`,
        day: dayStart(t.endedAt),
        userKey: YOU.key,
        kind: recorded(t) ? "earned" : "pending",
        amount: t.emissions.tokens,
        mode: modeFromVehicle(t.vehicle.category, t.vehicle.fuel),
        origin: "session",
      });
    }
    for (const g of input.rewardEvents.filter((e) => e.kind === "grant")) {
      youRewards.push({ id: g.id, day: dayStart(g.at), userKey: YOU.key, kind: "earned", amount: g.amount, origin: "session", label: "Demo top-up" });
    }
    for (const r of input.redemptions) {
      if (r.status === "simulated" || r.status === "completed") {
        youRewards.push({ id: r.id, day: dayStart(r.createdAt), userKey: YOU.key, kind: "redeemed", amount: r.amount, origin: "session", label: r.itemName });
      }
    }
  }
  // Pending on-chain-mode trips still come from local trips (verified, not yet recorded).
  if (onchain) {
    for (const t of mine) {
      if (t.status === "VERIFIED" && t.emissions && t.emissions.tokens > 0 && !recorded(t)) {
        youRewards.push({ id: `${t.id}-p`, day: dayStart(t.endedAt), userKey: YOU.key, kind: "pending", amount: t.emissions.tokens, mode: modeFromVehicle(t.vehicle.category, t.vehicle.fuel), origin: "session" });
      }
    }
  }

  const redemptionTimes = input.redemptions.map((r) => r.updatedAt);
  return {
    today,
    coverageStart: addDays(today, -(COVERAGE_DAYS - 1)),
    journeys: [...demo.journeys, ...youJourneys],
    rewards: [...demo.rewards, ...youRewards],
    commuters: [...demo.commuters, YOU],
    has: { demo: true, session: mine.length > 0 || input.redemptions.length > 0 || youRewards.length > 0, onchain },
    counts: {
      demoCommuters: demo.commuters.length,
      demoJourneys: demo.journeys.length,
      sessionTrips: mine.length,
      sessionRedemptions: input.redemptions.length,
      chainEvents: onchain ? input.chainEvents!.length : 0,
    },
    latest: {
      trip: mine.length ? Math.max(...mine.map((t) => t.endedAt)) : null,
      redemption: redemptionTimes.length ? Math.max(...redemptionTimes) : null,
      registration: input.registeredAt,
      chain: onchain ? input.chainAt : null,
    },
  };
}
