/**
 * Network configuration. Portal V3 is the only network MissionEV accepts for real wallets.
 *
 * The chain id, EVM endpoint and currency are the organisers' published testnet values, so MetaMask can be asked to add
 * the network with no setup (environment variables still override them). The explorer address is left empty on purpose:
 * transaction links are built as `<explorer>/tx/<hash>`, and the Portaldot node console is not known to use that scheme,
 * so a guessed default would produce dead links.
 */
export const PORTAL_V3 = {
  chainId: 420420777,
  name: "Portal V3 Testnet",
  shortName: "Portal V3",
  rpcUrl: process.env.NEXT_PUBLIC_PORTAL_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev",
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
