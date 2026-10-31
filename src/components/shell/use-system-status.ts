"use client";

import { PORTAL_V3 } from "@/lib/chain";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useWallet } from "@/providers/wallet-provider";

export type StatusTone = "neutral" | "ok" | "warn" | "cyan";

/**
 * Derived only from state we actually observe (the signed-in account + an injected wallet's eth_chainId).
 * Nothing here pings a node, so "WALLET CONNECTED" means "wallet connected on Portal V3". Signing in with a
 * mobile number needs no wallet, so without one the account is a demo account.
 */
export function useSystemStatus(): { label: string; short: string; tone: StatusTone } {
  const w = useWallet();
  const { registration } = useOnboarding();
  if (w.isDemo) return { label: "DEMO (SIMULATED)", short: `DEMO · ${PORTAL_V3.chainId}`, tone: "warn" };
  if (w.isConnected) {
    if (!w.onExpectedChain) return { label: `WRONG NETWORK (${w.chainId})`, short: `WRONG NETWORK · ${w.chainId}`, tone: "warn" };
    return { label: "WALLET CONNECTED", short: `${PORTAL_V3.shortName.toUpperCase()} · ${w.chainId}`, tone: "ok" };
  }
  if (registration) return { label: "DEMO ACCOUNT (SIMULATED)", short: "DEMO ACCOUNT", tone: "warn" };
  return { label: "SIGNED OUT", short: "SIGNED OUT", tone: "neutral" };
}
