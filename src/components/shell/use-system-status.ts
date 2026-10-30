"use client";

import { PORTAL_V3 } from "@/lib/chain";
import { useWallet } from "@/providers/wallet-provider";

export type StatusTone = "neutral" | "ok" | "warn" | "cyan";

/**
 * Derived only from state we actually observe (injected wallet + eth_chainId).
 * Nothing here pings a node, so "CONNECTED" means "wallet connected on Portal V3".
 */
export function useSystemStatus(): { label: string; short: string; tone: StatusTone } {
  const w = useWallet();
  if (w.isDemo) return { label: "DEMO (SIMULATED)", short: `DEMO · ${PORTAL_V3.chainId}`, tone: "warn" };
  if (!w.isConnected) return { label: "NO WALLET CONNECTED", short: "NO WALLET", tone: "neutral" };
  if (!w.onExpectedChain)
    return { label: `WRONG NETWORK (${w.chainId})`, short: `WRONG NETWORK · ${w.chainId}`, tone: "warn" };
  return { label: "WALLET CONNECTED", short: `${PORTAL_V3.shortName.toUpperCase()} · ${w.chainId}`, tone: "ok" };
}
