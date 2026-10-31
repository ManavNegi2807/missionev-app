import { TRANSPORT_MODE } from "./contractMapping";

/**
 * Integer-exact replica of MissionEV.sol's reward arithmetic (`_updateStreak`, `_computeReward`, `_updateScore`), so the UI
 * can show what a signed trip WOULD mint before anything is sent. It is a preview only: the contract's own result,
 * read back after the transaction, is the truth. A test runs both against the compiled contract.
 */

const E18 = BigInt("1000000000000000000");
const BPS = BigInt(10000);
const DAY = 86400;

export interface CommuterState {
  carbonScore: number;
  streakDays: number;
  lastTripTimestamp: number;
  totalAvoidedGramsCO2: number;
  totalTripsLogged: number;
}

export const EMPTY_COMMUTER: CommuterState = { carbonScore: 0, streakDays: 0, lastTripTimestamp: 0, totalAvoidedGramsCO2: 0, totalTripsLogged: 0 };

/** Streak after a trip at `nowSec`, as `_updateStreak` computes it (it runs before the reward). */
export function streakAfterTrip(state: Pick<CommuterState, "streakDays" | "lastTripTimestamp">, nowSec: number): number {
  const currentDay = Math.floor(nowSec / DAY);
  const lastDay = Math.floor(state.lastTripTimestamp / DAY);
  if (state.lastTripTimestamp === 0) return 1;
  if (currentDay === lastDay + 1) return state.streakDays + 1;
  if (currentDay > lastDay + 1) return 1;
  return state.streakDays; // same calendar day: the streak stays, but the trip still mints
}

export const streakMultiplierBps = (streakDays: number): number => (streakDays >= 20 ? 30000 : streakDays >= 10 ? 20000 : streakDays >= 5 ? 15000 : 10000);

/** Mode bonus in whole MEV: ACTIVE 15; EV_CAR, EV_2W and METRO 10; everything else 0. Paid even when avoided grams are 0. */
export const modeBonusMev = (mode: number): number => (mode === TRANSPORT_MODE.ACTIVE ? 15 : mode === TRANSPORT_MODE.EV_CAR || mode === TRANSPORT_MODE.EV_2W || mode === TRANSPORT_MODE.METRO ? 10 : 0);

export interface RewardPreview {
  streakDays: number;
  multiplierBps: number;
  /** 20 MEV per kg avoided, before the streak multiplier (wei, 18 decimals). */
  baseWei: bigint;
  afterStreakWei: bigint;
  modeBonusWei: bigint;
  rewardWei: bigint;
  formula: string;
}

export function previewReward(args: { commuter: Pick<CommuterState, "streakDays" | "lastTripTimestamp">; mode: number; co2AvoidedGrams: number; nowSec: number }): RewardPreview {
  const streakDays = streakAfterTrip(args.commuter, args.nowSec);
  const multiplierBps = streakMultiplierBps(streakDays);
  const baseWei = (BigInt(args.co2AvoidedGrams) * BigInt(20) * E18) / BigInt(1000);
  const afterStreakWei = (baseWei * BigInt(multiplierBps)) / BPS;
  const bonus = modeBonusMev(args.mode);
  const modeBonusWei = BigInt(bonus) * E18;
  const rewardWei = afterStreakWei + modeBonusWei;
  const mult = multiplierBps / 10000;
  return {
    streakDays,
    multiplierBps,
    baseWei,
    afterStreakWei,
    modeBonusWei,
    rewardWei,
    formula: `${args.co2AvoidedGrams} g × 20 MEV/kg ÷ 1000 × ${mult}× streak (${streakDays} day${streakDays === 1 ? "" : "s"}) + ${bonus} MEV mode bonus`,
  };
}

/** `_updateScore`: +8 above 2000 g, +4 above 500 g, otherwise +2; starts at 500, capped at 1000. */
export function scoreAfterTrip(current: number, co2AvoidedGrams: number): number {
  const start = current === 0 ? 500 : current;
  const step = co2AvoidedGrams > 2000 ? 8 : co2AvoidedGrams > 500 ? 4 : 2;
  return Math.min(1000, start + step);
}

/** 18-decimal wei → a display string with up to `dp` decimals (viem's formatUnits is used where a precise string is needed). */
export function formatMev(wei: bigint, dp = 2): string {
  const whole = wei / E18;
  const frac = ((wei % E18) * BigInt(10) ** BigInt(dp)) / E18;
  return dp === 0 ? whole.toString() : `${whole.toString()}.${frac.toString().padStart(dp, "0")}`;
}
