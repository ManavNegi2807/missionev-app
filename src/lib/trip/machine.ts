import type { TripStatus } from "./types";

/**
 * Explicit journey state machine:
 * IDLE → RECORDING → PAUSED → COMPLETED → VERIFYING → VERIFIED / FAILED
 */
export type TripEvent = "START" | "PAUSE" | "RESUME" | "STOP" | "VERIFY" | "PASS" | "FAIL" | "RESET";

const TABLE: Record<TripStatus, Partial<Record<TripEvent, TripStatus>>> = {
  IDLE: { START: "RECORDING" },
  RECORDING: { PAUSE: "PAUSED", STOP: "COMPLETED" },
  PAUSED: { RESUME: "RECORDING", STOP: "COMPLETED" },
  COMPLETED: { VERIFY: "VERIFYING" },
  VERIFYING: { PASS: "VERIFIED", FAIL: "FAILED" },
  VERIFIED: {},
  FAILED: {},
};

export function transition(status: TripStatus, event: TripEvent): TripStatus | null {
  if (event === "RESET") return "IDLE";
  return TABLE[status][event] ?? null;
}

export const canFire = (status: TripStatus, event: TripEvent) => transition(status, event) !== null;

export const STATUS_ORDER: TripStatus[] = ["IDLE", "RECORDING", "PAUSED", "COMPLETED", "VERIFYING", "VERIFIED"];
