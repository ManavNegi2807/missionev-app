import { PORTAL_V3 } from "@/lib/chain";

/**
 * The deployed MissionEV contract as the browser knows it. The address is public by nature (it's on-chain), so it may live in
 * a NEXT_PUBLIC_ variable. Without it nothing can be read or recorded and the app stays in DEMO.
 */
export const CONTRACT = {
  name: "MissionEV",
  address: process.env.NEXT_PUBLIC_MEV_CONTRACT_ADDRESS ?? "",
  chainId: PORTAL_V3.chainId,
  gasSymbol: PORTAL_V3.currencySymbol,
  /** The reward token defined inside MissionEV.sol: "MissionEV Carbon Reward", 18 decimals. Not tPOT, and not a certified carbon credit. */
  rewardSymbol: "$MEV",
  tokenSymbol: "MEV",
  tokenName: "MissionEV Carbon Reward",
  decimals: 18,
} as const;

export const isContractAddress = (s: string): s is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(s);

export type ContractStatus = { kind: "not-configured" | "address-set"; label: string; detail: string };

export function contractStatus(): ContractStatus {
  if (!isContractAddress(CONTRACT.address)) {
    return {
      kind: "not-configured",
      label: "NOT CONFIGURED",
      detail: "No deployed MissionEV address is set (NEXT_PUBLIC_MEV_CONTRACT_ADDRESS), so nothing can be read from or recorded on-chain.",
    };
  }
  return { kind: "address-set", label: "ADDRESS SET", detail: "A MissionEV address is configured. Whether code exists there is checked when a wallet is connected." };
}
