import { PORTAL_V3 } from "@/lib/chain";
import { TRUST_INDEX } from "./emissions";
import type { GpsSample, LedgerPreview, TripRecord } from "./types";

/**
 * MissionEVRewards.sol (found in the project repo zip, not in this app) — what the front end knows:
 *  - `submitTrip(user, tripHash, vehicleId, distanceMeters, trust)` is `onlyOracle`. A commuter's
 *    wallet cannot call it; in the architecture the backend "reward service" holds the oracle key.
 *  - No deployed address or compiled ABI exists in the repo, so nothing can be sent to a chain yet.
 *
 * Therefore this module can only build a PREVIEW: a real keccak256 trip hash and real ABI-encoded
 * calldata for what the oracle would submit. It never returns a transaction hash.
 */
export const CONTRACT = {
  name: "MissionEVRewards",
  address: process.env.NEXT_PUBLIC_MEV_CONTRACT_ADDRESS ?? "",
  // Transcribed from the Solidity source (TrustLevel enum = uint8).
  submitTripAbi: [
    "function submitTrip(address _user, bytes32 _tripHash, uint256 _vehicleId, uint256 _distanceMeters, uint8 _trust) returns (uint256 tokens)",
  ] as const,
  chainId: PORTAL_V3.chainId,
  gasSymbol: "tPOT",
  rewardSymbol: "$MEV",
  contractTokenSymbol: "GRT",
} as const;

export type ContractStatus = {
  kind: "not-configured" | "address-set";
  label: string;
  detail: string;
};

export function contractStatus(): ContractStatus {
  if (!CONTRACT.address) {
    return {
      kind: "not-configured",
      label: "NOT CONFIGURED",
      detail:
        "No deployed MissionEVRewards address is configured (NEXT_PUBLIC_MEV_CONTRACT_ADDRESS) and no compiled ABI exists in the project.",
    };
  }
  return {
    kind: "address-set",
    label: "ADDRESS SET · UNVERIFIED",
    detail: "An address is configured but this build can't confirm a contract exists there. Submission stays disabled: submitTrip is oracle-only.",
  };
}

const rounded = (s: GpsSample[]) => s.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");

export async function buildLedgerPreview(args: {
  record: TripRecord;
  samples: GpsSample[];
  userAddress: string;
  vehicleId: number;
}): Promise<LedgerPreview> {
  const { keccak256, toHex, encodeFunctionData, parseAbi } = await import("viem");
  const { record } = args;
  const tier = record.verification!.trust.tier;
  const trustIndex = TRUST_INDEX[tier];
  const distanceMeters = Math.max(1, Math.round(record.distanceKm * 1000));

  // docs/SECURITY_PRIVACY.md: tripHash = keccak256(userId ‖ startTime ‖ endTime ‖ routeDigest ‖ salt)
  const routeDigest = keccak256(toHex(rounded(args.samples)));
  const tripHash = keccak256(toHex(`${record.userId}|${record.startedAt}|${record.endedAt}|${routeDigest}|${record.salt}`));

  const abi = parseAbi(CONTRACT.submitTripAbi);
  const calldata = encodeFunctionData({
    abi,
    functionName: "submitTrip",
    args: [args.userAddress.toLowerCase() as `0x${string}`, tripHash, BigInt(args.vehicleId), BigInt(distanceMeters), trustIndex],
  });

  return {
    userAddress: args.userAddress,
    vehicleId: args.vehicleId,
    distanceMeters,
    trustIndex,
    trustTier: tier,
    routeDigest,
    tripHash,
    selector: calldata.slice(0, 10),
    calldata,
    wouldMint: record.emissions?.tokens ?? 0,
    at: Date.now(),
  };
}
