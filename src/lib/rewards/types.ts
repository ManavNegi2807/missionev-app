/**
 * Shared reward + redemption data model.
 * D3 (Smart-contract Ledger) feeds rewards in; D4 (Redemptions) stores what the commuter redeems (simulated: the contract has no redeem).
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
  /** Always "demo": the MissionEV contract has no redeem or burn function, so no redemption can move tokens. */
  mode: "demo";
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

/** A real MissionEV event read through the wallet's provider. Amounts are exact: `amountWei` is a decimal string of 18-decimal wei. */
export interface ChainEvent {
  id: string;
  /** "reward": minted by a recorded commute. "transfer-out" / "transfer-in": ordinary token transfers. The contract has no redeem. */
  kind: "reward" | "transfer-out" | "transfer-in";
  amount: number;
  amountWei: string;
  at: number | null;
  wallet: string;
  txHash: string;
  blockNumber: number;
  co2SavedGrams?: number;
  tripId?: string;
}

export interface OnchainSnapshot {
  hasCode: boolean;
  /** `balanceOf` in $MEV for display; the exact value is `balanceWei`. */
  balance: number | null;
  balanceWei: string | null;
  commuter: { carbonScore: number; streakDays: number; lastTripTimestamp: number; totalAvoidedGramsCO2: number; totalTripsLogged: number } | null;
  events: ChainEvent[] | null;
  /** Sum of Transfer(0x0 → you): everything recorded commutes have minted to this wallet. */
  earned: number | null;
  /** Sum of Transfer(you → anyone): tokens sent away. Not "redeemed": the contract has no redeem function. */
  transferredOut: number | null;
  avoidedG: number | null;
  eventsError?: string;
  at: number;
}
