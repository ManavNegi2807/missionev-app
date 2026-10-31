import { privateKeyToAccount } from "viem/accounts";
import { hexToBytes, type Hex } from "viem";
import { buildTripTypedData, type TripPayload } from "./typedData";

/**
 * Signs a TripPayload as the trusted oracle. SERVER ONLY: this takes the private key as an argument, so it must never be
 * imported from a client component. The key itself is read from server-side configuration by the caller, never from a
 * NEXT_PUBLIC_ variable.
 *
 * viem returns the 65-byte `r ‖ s ‖ v` form with v = 27/28 and a low-s value, which is what the contract's assembly
 * unpacking and `ecrecover` expect.
 */
export async function signTripPayload(args: { privateKey: Hex; chainId: number; verifyingContract: Hex; payload: TripPayload }): Promise<Hex> {
  const account = privateKeyToAccount(args.privateKey);
  const signature = await account.signTypedData(buildTripTypedData(args));
  if (hexToBytes(signature).length !== 65) throw new Error("Unexpected signature length");
  return signature;
}

export const oracleAddressOf = (privateKey: Hex): Hex => privateKeyToAccount(privateKey).address;
