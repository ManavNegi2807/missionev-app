"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, Button } from "@/components/ui/primitives";
import { useWallet } from "@/providers/wallet-provider";

const LINK =
  "inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-elevated px-3 font-mono text-xs tracking-[0.1em] text-fg uppercase hover:border-cyan/50 hover:text-cyan";

/** Phones have no extension: MetaMask's own app opens this page in its built-in browser, where a wallet is injected. */
const onPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const metaMaskAppLink = () => `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;

/** Shared error surface for the sign-in panel and the top-bar account menu. Only renders after a wallet action has failed. */
export function WalletError() {
  const w = useWallet();
  if (!w.error) return null;
  const { code, message } = w.error;

  const titles: Record<typeof code, string> = {
    "no-wallet": "MetaMask not detected",
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
          {code === "no-wallet" && onPhone() && (
            <a href={metaMaskAppLink()} className={LINK}>
              Open in MetaMask app <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
          {code === "no-wallet" && (
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className={LINK}>
              Install MetaMask <ExternalLink aria-hidden className="size-3.5" />
            </a>
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
