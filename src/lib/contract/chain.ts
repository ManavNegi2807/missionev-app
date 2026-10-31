import { defineChain } from "viem";
import { PORTAL_V3 } from "@/lib/chain";

/** Portal V3 testnet as a viem chain, for server-side reads and local test deployments. */
export const portalChain = (rpcUrl: string = PORTAL_V3.rpcUrl) =>
  defineChain({
    id: PORTAL_V3.chainId,
    name: PORTAL_V3.name,
    nativeCurrency: { name: PORTAL_V3.currencySymbol, symbol: PORTAL_V3.currencySymbol, decimals: 18 },
    rpcUrls: { default: { http: rpcUrl ? [rpcUrl] : [] } },
  });
