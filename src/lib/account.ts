import { fnv1a, sha256Hex } from "@/lib/format";

/**
 * How a commuter signs in. A wallet address is the account: connecting MetaMask shares only the public address (no seed
 * phrase, no private key, no gas). Browsers without a wallet can use a clearly labelled demo account, so the app stays
 * usable for anyone, but nothing a demo account does is ever on-chain.
 */
export type AccountMethod = "wallet" | "demo";

export const isAddress = (s: unknown): s is string => typeof s === "string" && /^0x[0-9a-fA-F]{40}$/.test(s);

/** A short, one-way id for an account: "usr_" plus 8 hex characters of the hashed address (case does not matter). */
export async function userIdFor(address: string): Promise<string> {
  const key = address.toLowerCase();
  const hash = await sha256Hex(`missionev:v2:account:${key}`);
  return `usr_${(hash ?? fnv1a(key).toString(16).padStart(8, "0")).slice(0, 8)}`;
}
