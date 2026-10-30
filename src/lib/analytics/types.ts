import type { ModeId } from "./modes";

/**
 * Shared analytics fact model. Every number on Screen 04 is derived from these two record types,
 * which are themselves built from D1/D2 (trips), D3 (ledger / demo) and D4 (redemptions).
 *
 * Definitions (single source of truth — see lib/analytics/definitions.ts):
 *  - Verified journey: trip with status VERIFIED and an emission result. All impact aggregates count verified journeys only.
 *  - Avoided emissions: Journey Lab rule — saving vs the petrol-bike baseline, counted only when below baseline, floored to whole grams.
 *  - Reward earned: tokens of verified journeys whose on-chain record was previewed/confirmed (+ demo top-ups). Pending = verified, not recorded yet.
 */
export type Origin = "demo" | "session" | "onchain";

export interface Journey {
  id: string;
  /** Local-midnight epoch ms. */
  day: number;
  /** Opaque user key. `"you"` is the commuter of this browser session. */
  userKey: string;
  mode: ModeId;
  distanceKm: number;
  baselineG: number;
  actualG: number;
  avoidedG: number;
  verified: boolean;
  /** Tokens this journey is worth under the contract rules (after trust tier + daily cap). */
  tokens: number;
  origin: Exclude<Origin, "onchain">;
  /** Session journeys only: whether the trip came from a simulator. */
  simulated?: boolean;
}

export interface RewardFact {
  id: string;
  day: number;
  userKey: string;
  kind: "earned" | "pending" | "redeemed";
  amount: number;
  /** Absent for demo top-ups, redemptions and on-chain events (cannot be attributed to a mode). */
  mode?: ModeId;
  origin: Origin;
  label?: string;
}

export interface Commuter {
  key: string;
  alias: string;
  archetype: string;
  isYou: boolean;
  isDemo: boolean;
}

export interface AnalyticsDataset {
  /** Local-midnight of "today" this dataset was built for. */
  today: number;
  /** Oldest day the dataset covers. */
  coverageStart: number;
  journeys: Journey[];
  rewards: RewardFact[];
  commuters: Commuter[];
  /** Composition — drives the DEMO / SESSION / ON-CHAIN labels. */
  has: { demo: boolean; session: boolean; onchain: boolean };
  counts: { demoCommuters: number; demoJourneys: number; sessionTrips: number; sessionRedemptions: number; chainEvents: number };
  /** Epoch ms of the newest real session record per source, when any exist. */
  latest: { trip: number | null; redemption: number | null; registration: number | null; chain: number | null };
}

export type Scope = "community" | "me";

export interface Filters {
  /** Inclusive local-midnight bounds. */
  start: number;
  end: number;
  scope: Scope;
  mode: ModeId | "all";
}
