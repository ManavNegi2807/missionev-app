import type { FuelType, VehicleCategory } from "@/lib/vehicle";

export type TripStatus = "IDLE" | "RECORDING" | "PAUSED" | "COMPLETED" | "VERIFYING" | "VERIFIED" | "FAILED";
export type TripSource = "gps" | "simulated";
/** Demo-only fault injection so the FAIL paths can be exercised deterministically. */
export type Scenario = "clean" | "gps-replay" | "route-mismatch" | "ridelog-mismatch";

export interface GpsSample {
  lat: number;
  lng: number;
  /** Epoch ms. For simulated trips this is a simulated clock, not wall time. */
  t: number;
  speedKmh: number;
  accuracy?: number;
}

export type CheckId = "3.1" | "3.2" | "3.3" | "3.4";
export type CheckStatus = "pending" | "running" | "pass" | "fail" | "demo" | "na";

export interface CheckItem {
  label: string;
  /** true = ok, false = failed, null = not evaluated */
  ok: boolean | null;
  detail: string;
}

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  /** True when the outcome comes from a mock / simulated input rather than a live service. */
  isDemo: boolean;
  summary: string;
  items: CheckItem[];
  technical: Record<string, string | number>;
  /** Epoch ms the result was actually generated; null until it runs. */
  at: number | null;
}

/** Contract trust tiers from MissionEVRewards.sol (TrustLevel enum). */
export type ContractTier = "Rejected" | "Bronze" | "Silver" | "Gold";

export interface TrustResult {
  assigned: boolean;
  /** Workflow stage number (4.0) — not an independently certified score. */
  level: number | null;
  tier: ContractTier;
  tierPercent: number;
  isDemo: boolean;
  failedConditions: string[];
  at: number;
}

export interface EmissionResult {
  distanceKm: number;
  distanceMeters: number;
  modeLabel: string;
  vehicleClass: string;
  contractVehicleId: number | null;
  mapping: "exact" | "none";
  kind: "electric" | "petrol" | "diesel" | "cng";
  basis: string;
  /** Energy consumed: litres (petrol/diesel), kg (CNG) or kWh (electric). */
  energyUsed: number;
  energyUnit: "L" | "kg" | "kWh";
  factorGPerKm: number;
  tailpipeG: number;
  generationG: number;
  estimatedG: number;
  baselineGPerKm: number;
  baselineG: number;
  /** baseline − estimated (negative when above baseline). */
  differenceG: number;
  /** Contract rule: saving counted only when below baseline, floored to whole grams. */
  savedG: number;
  tokensBeforeTrust: number;
  trustPercent: number;
  tokensAfterTrust: number;
  dailyCap: number;
  capRemaining: number;
  tokens: number;
  isDemo: boolean;
}

export interface LedgerPreview {
  userAddress: string;
  vehicleId: number;
  distanceMeters: number;
  trustIndex: number;
  trustTier: ContractTier;
  routeDigest: string;
  tripHash: string;
  selector: string;
  calldata: string;
  wouldMint: number;
  at: number;
}

export interface LedgerState {
  /** "pending" | "confirmed" | "failed" are reserved for a real submission path that is not enabled. */
  phase: "not-submitted" | "previewed" | "pending" | "confirmed" | "failed";
  preview?: LedgerPreview;
  unavailableReason?: string;
  txHash?: string;
}

export interface TripRecord {
  id: string;
  /** Final lifecycle status when stored. */
  status: TripStatus;
  source: TripSource;
  isSimulated: boolean;
  scenario: Scenario;
  routeId: string | null;
  routeName: string | null;
  startedAt: number;
  endedAt: number;
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  sampleCount: number;
  /** Rounded to ~110 m so stored history can't reconstruct a home address. */
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  speedProfile: number[];
  fingerprint: string;
  salt: string;
  vehicle: { maskedReg: string; category: VehicleCategory; fuel: FuelType; manufacturer: string; model: string };
  wallet: { address: string; chainId: number | null; mode: "browser" | "demo" };
  userId: string;
  verification: { checks: Record<CheckId, CheckResult>; trust: TrustResult } | null;
  emissions: EmissionResult | null;
  ledger: LedgerState;
  /** In-memory only (stripped before persisting): downsampled path for the map. */
  path?: Array<{ lat: number; lng: number }>;
}
