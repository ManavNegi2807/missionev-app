"use client";

import { AlertTriangle, ExternalLink, FlaskConical } from "lucide-react";
import { Alert, Button } from "@/components/ui/primitives";
import { useWallet } from "@/providers/wallet-provider";

/** Shared error surface for the wallet panel and the top-bar popover. */
export function WalletError({ onDone }: { onDone?: () => void }) {
  const w = useWallet();
  if (!w.error) return null;
  const { code, message } = w.error;

  const titles: Record<typeof code, string> = {
    "no-wallet": "No wallet detected",
    rejected: "Connection rejected",
    "request-pending": "Request already pending",
    failed: "Wallet error",
    disconnected: "Wallet disconnected",
    "chain-missing": "Network not in wallet",
    "switch-rejected": "Network switch not completed",
  };

  return (
    <Alert
      role="alert"
      tone={code === "no-wallet" ? "cyan" : "err"}
      icon={<AlertTriangle aria-hidden className="size-4" />}
      title={titles[code]}
      actions={
        <>
          {code === "no-wallet" && (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-elevated px-3 font-mono text-xs tracking-[0.1em] text-fg uppercase hover:border-cyan/50 hover:text-cyan"
            >
              Install MetaMask <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
          {(code === "no-wallet" || code === "failed") && (
            <Button
              size="sm"
              icon={<FlaskConical aria-hidden className="size-3.5" />}
              onClick={() => {
                w.enterDemo();
                onDone?.();
              }}
            >
              Use demo mode
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={w.clearError}>
            Dismiss
          </Button>
        </>
      }
    >
      {message}
    </Alert>
  );
}
