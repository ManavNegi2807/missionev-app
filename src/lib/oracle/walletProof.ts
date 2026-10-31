/**
 * The message a commuter's wallet signs (personal_sign / EIP-191) to ask the oracle for a trip signature. It proves the
 * request comes from the holder of that address, is bound to one trip, one contract and one chain, and goes stale after
 * five minutes. It is NOT a login session and signing it costs no gas.
 */
export const PROOF_MAX_AGE_MS = 5 * 60 * 1000;

export function oracleRequestMessage(args: { commuter: string; clientTripId: string; contract: string; chainId: number; issuedAt: number }): string {
  return [
    "MissionEV · request oracle signature",
    "",
    "I am asking the MissionEV oracle to verify this journey so I can record it on-chain from my own wallet.",
    "Signing this message costs no gas and does not move any tokens.",
    "",
    `Commuter: ${args.commuter.toLowerCase()}`,
    `Trip: ${args.clientTripId}`,
    `Contract: ${args.contract.toLowerCase()}`,
    `Chain ID: ${args.chainId}`,
    `Issued at (ms): ${args.issuedAt}`,
  ].join("\n");
}
