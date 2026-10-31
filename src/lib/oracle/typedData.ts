import { encodeAbiParameters, keccak256, parseAbiParameters, type Hex } from "viem";

/**
 * The EIP-712 structure MissionEV.sol verifies in `recordCommute`. Field names, types and ORDER must match the Solidity
 * `TRIP_TYPEHASH` string exactly:
 *   TripPayload(address commuter,bytes32 tripId,uint8 mode,uint32 distanceMeters,uint32 co2AvoidedGrams,uint256 nonce,uint256 deadline)
 * Domain: name "MissionEV", version "1", chainId = chain the contract is deployed on, verifyingContract = its address.
 * A test checks this against the compiled contract's own TRIP_TYPEHASH and DOMAIN_SEPARATOR.
 */
export const TRIP_TYPES = {
  TripPayload: [
    { name: "commuter", type: "address" },
    { name: "tripId", type: "bytes32" },
    { name: "mode", type: "uint8" },
    { name: "distanceMeters", type: "uint32" },
    { name: "co2AvoidedGrams", type: "uint32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const TRIP_TYPE_STRING =
  "TripPayload(address commuter,bytes32 tripId,uint8 mode,uint32 distanceMeters,uint32 co2AvoidedGrams,uint256 nonce,uint256 deadline)";

export interface TripPayload {
  commuter: Hex;
  tripId: Hex;
  mode: number;
  distanceMeters: number;
  co2AvoidedGrams: number;
  nonce: bigint;
  deadline: bigint;
}

export const eip712Domain = (chainId: number, verifyingContract: Hex) => ({ name: "MissionEV", version: "1", chainId, verifyingContract }) as const;

const UINT32_MAX = 4_294_967_295;
const isUint32 = (n: number) => Number.isInteger(n) && n >= 0 && n <= UINT32_MAX;

/** Throws unless every field fits the Solidity type it will be encoded as. Signing a value that overflows would sign a different one. */
export function assertPayload(p: TripPayload): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(p.commuter)) throw new RangeError("commuter must be a 20-byte address");
  if (!/^0x[0-9a-fA-F]{64}$/.test(p.tripId)) throw new RangeError("tripId must be exactly 32 bytes");
  if (!Number.isInteger(p.mode) || p.mode < 0 || p.mode > 6) throw new RangeError("mode must be a TransportMode value 0–6");
  if (!isUint32(p.distanceMeters)) throw new RangeError("distanceMeters must be an integer that fits uint32");
  if (!isUint32(p.co2AvoidedGrams)) throw new RangeError("co2AvoidedGrams must be a non-negative integer that fits uint32");
  if (p.nonce < BigInt(0) || p.deadline < BigInt(0)) throw new RangeError("nonce and deadline must be non-negative");
}

export function buildTripTypedData(args: { chainId: number; verifyingContract: Hex; payload: TripPayload }) {
  assertPayload(args.payload);
  return {
    domain: eip712Domain(args.chainId, args.verifyingContract),
    types: TRIP_TYPES,
    primaryType: "TripPayload" as const,
    message: args.payload,
  };
}

/**
 * A deterministic 32-byte trip id: the same trip always yields the same id, so a retried request is idempotent and the
 * contract's `processedTrips` blocks a replay. Bound to the commuter and the trip's time window and route digest.
 * No coordinates go into it, only a hash of the rounded route.
 */
export function deriveTripId(args: { commuter: Hex; clientTripId: string; startedAt: number; endedAt: number; routeDigest: Hex }): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("address commuter, string clientTripId, uint64 startedAt, uint64 endedAt, bytes32 routeDigest"), [
      args.commuter,
      args.clientTripId,
      BigInt(args.startedAt),
      BigInt(args.endedAt),
      args.routeDigest,
    ]),
  );
}
