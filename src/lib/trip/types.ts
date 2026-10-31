import type { CarbonResult, JourneyMode, VehicleEnergySpec } from "@/lib/carbon/types";
import type { RideProvider } from "@/lib/ocr/receipt";

export type TripStatus = "IDLE" | "RECORDING" | "PAUSED" | "COMPLETED" | "VERIFYING" | "VERIFIED" | "FAILED";
export type TripSource = "gps" | "simulated";
/** The transport used for THIS journey (chosen per trip, independent of what the commuter owns). */
export type TravelMode = JourneyMode;
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

/** Off-chain trust tiers. They describe how much evidence backs a trip; they do not scale the on-chain reward. */
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

/** The vehicle used on a trip, frozen at the time so later profile edits can't change a past result. */
export interface TripVehicle {
  /** Saved-profile id, or "ride-hail" for a vehicle confirmed from a receipt. */
  id: string;
  label: string;
  spec: VehicleEnergySpec;
}

export interface RideHailInfo {
  provider: RideProvider;
  occupants: number;
  receipt: {
    distanceKm: number | null;
    tripDate: string | null;
    serviceClass: string | null;
    /** How the details were obtained: read by OCR then reviewed, or typed by the commuter. */
    source: "ocr-reviewed" | "manual";
    /** The commuter confirmed the vehicle and fuel shown here. OCR alone never proves either. */
    confirmedByUser: boolean;
    ocrConfidence?: { provider: string; distance: string; vehicle: string };
  };
}

export type ApplicationMode = "DEMO" | "LIVE";

export interface SignedTrip {
  tripId: string;
  mode: number;
  modeName: string;
  distanceMeters: number;
  co2AvoidedGrams: number;
  /** Decimal strings: bigint isn't JSON-safe. */
  nonce: string;
  deadline: number;
  signature: string;
  oracle: string;
  contract: string;
  chainId: number;
  signedAt: number;
}

/**
 * Where a verified trip's reward stands. DEMO trips are credited in the browser only. LIVE trips go
 * oracle signature → the commuter's own wallet submits `recordCommute` → receipt → contract state read back.
 */
export interface Settlement {
  applicationMode: ApplicationMode;
  phase: "not-started" | "demo-credited" | "signed" | "wallet-pending" | "confirmed" | "failed" | "refused";
  oracle: {
    status: "not-requested" | "requesting" | "signed" | "refused" | "unavailable" | "error";
    reason?: string;
    signed?: SignedTrip;
  };
  tx: {
    status: "none" | "awaiting-wallet" | "pending" | "confirmed" | "reverted" | "rejected" | "error";
    hash?: string;
    blockNumber?: number;
    error?: string;
  };
  /** Exact values read from the contract after confirmation. Wei amounts are decimal strings. */
  onchain?: { mintedWei: string; balanceWei: string; streakDays: number; carbonScore: number; totalAvoidedGrams: number; readAt: number };
  /** DEMO only: the browser-local credit, never an on-chain amount. */
  demo?: { creditedMev: number; at: number };
  /** What the contract's reward formula would mint for this trip (a preview; the contract's own result is the truth). */
  preview?: { rewardMev: number; streakDays: number; formula: string };
}

export const NOT_STARTED: Settlement = { applicationMode: "DEMO", phase: "not-started", oracle: { status: "not-requested" }, tx: { status: "none" } };

export interface TripRecord {
  id: string;
  /** Final lifecycle status when stored. */
  status: TripStatus;
  source: TripSource;
  /** How the commuter travelled on this journey. */
  mode: TravelMode;
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
  /** Hash of the rounded route, used to derive the on-chain trip id. No coordinates. */
  routeDigest: string;
  salt: string;
  /** The vehicle that carried the commuter. null for metro, bus and walking. */
  vehicle: TripVehicle | null;
  rideHail: RideHailInfo | null;
  wallet: { address: string; chainId: number | null; mode: "browser" | "demo" };
  userId: string;
  verification: { checks: Record<CheckId, CheckResult>; trust: TrustResult } | null;
  /** The full carbon calculation (factors, formulas, sources, assumptions). */
  carbon: CarbonResult | null;
  settlement: Settlement;
  /** In-memory only (stripped before persisting): downsampled path for the map. */
  path?: Array<{ lat: number; lng: number }>;
}
