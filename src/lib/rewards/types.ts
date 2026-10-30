/**
 * Shared reward + redemption data model.
 * D3 (Smart-contract Ledger) feeds rewards in; D4 (Redemptions) stores what the commuter redeems.
 * Later analytics screens can aggregate `RedemptionRecord` and `RewardEvent` directly.
 */
export type RedemptionStatus = "pending" | "completed" | "failed" | "simulated";

export interface RedemptionRecord {
  /** Human-facing reference, e.g. RDM-K3F9QA. */
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  group: string;
  /** $MEV cost. */
  amount: number;
  status: RedemptionStatus;
  /** "demo": local record, no tokens moved. "onchain": a real redeem() transaction was requested. */
  mode: "demo" | "onchain";
  createdAt: number;
  updatedAt: number;
  wallet: { address: string; chainId: number | null };
  balanceBefore: number;
  balanceAfter: number;
  /** Only ever set from a hash a wallet actually returned. */
  txHash?: string;
  blockNumber?: number;
  error?: string;
  /** Commuter voucher (end of the data-flow). Demo vouchers are not redeemable anywhere. */
  voucher?: { code: string; isDemo: boolean };
}

/** An illustrative reward event derived from local trip / demo data (never on-chain). */
export interface RewardEvent {
  id: string;
  kind: "trip" | "grant";
  at: number;
  amount: number;
  label: string;
  status: string;
  tripId?: string;
}

/** A real contract event read through the wallet's provider. */
export interface ChainEvent {
  id: string;
  kind: "reward" | "redeem";
  amount: number;
  at: number | null;
  wallet: string;
  txHash: string;
  blockNumber: number;
  co2SavedGrams?: number;
  rewardId?: string;
}

export interface OnchainSnapshot {
  hasCode: boolean;
  balance: number | null;
  events: ChainEvent[] | null;
  earned: number | null;
  redeemed: number | null;
  avoidedG: number | null;
  eventsError?: string;
  at: number;
}
