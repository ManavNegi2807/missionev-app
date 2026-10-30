/**
 * Network configuration. Portal V3 is the only network MissionEV accepts for
 * real wallets. The RPC URL / currency are intentionally read from env so we
 * never ship guessed network parameters; without them the app can still
 * *switch* to the chain if the wallet already knows it, but won't try to add it.
 */
export const PORTAL_V3 = {
  chainId: 420420777,
  name: "Portal V3 Testnet",
  shortName: "Portal V3",
  rpcUrl: process.env.NEXT_PUBLIC_PORTAL_RPC_URL ?? "",
  explorerUrl: process.env.NEXT_PUBLIC_PORTAL_EXPLORER_URL ?? "",
  /** tPOT is the native gas currency on Portal V3 testnet ($MEV is the separate reward token). */
  currencySymbol: process.env.NEXT_PUBLIC_PORTAL_CURRENCY_SYMBOL || "tPOT",
} as const;

export const toHexChainId = (id: number) => `0x${id.toString(16)}`;

export const canAddPortalChain = () => Boolean(PORTAL_V3.rpcUrl && PORTAL_V3.currencySymbol);

const KNOWN_CHAINS: Record<number, string> = {
  1: "Ethereum Mainnet",
  10: "OP Mainnet",
  56: "BNB Smart Chain",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum One",
  11155111: "Sepolia",
  [PORTAL_V3.chainId]: PORTAL_V3.name,
};

export function chainName(chainId: number | null): string {
  if (chainId === null) return "—";
  return KNOWN_CHAINS[chainId] ?? "Unknown network";
}
