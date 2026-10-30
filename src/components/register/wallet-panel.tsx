"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, FlaskConical, LogOut, Network, ShieldCheck } from "lucide-react";
import { WalletFoxIcon } from "@/components/brand/logo";
import { WalletError } from "@/components/shell/wallet-error";
import { Alert, Badge, Button, KV, Panel, PanelHeader } from "@/components/ui/primitives";
import { PORTAL_V3 } from "@/lib/chain";
import { formatTimestamp, shortAddress } from "@/lib/format";
import { useWallet } from "@/providers/wallet-provider";

export function WalletPanel() {
  const w = useWallet();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!w.address) return;
    try {
      await navigator.clipboard.writeText(w.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const status = !w.isConnected
    ? { tone: "neutral" as const, text: "Disconnected" }
    : w.isDemo
      ? { tone: "warn" as const, text: "Demo wallet" }
      : w.onExpectedChain
        ? { tone: "ok" as const, text: "Connected" }
        : { tone: "warn" as const, text: "Wrong network" };

  return (
    <Panel aria-labelledby="wallet-title">
      <PanelHeader
        id="wallet-title"
        eyebrow="Step 1 · Identity"
        title="Wallet connection"
        subtitle={`Connect a browser wallet on ${PORTAL_V3.name}. MissionEV never asks for keys or seed phrases.`}
        action={
          <Badge tone={status.tone} dot>
            {status.text}
          </Badge>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line-strong bg-bg-2">
              <WalletFoxIcon className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{w.isDemo ? "Demo identity (simulated)" : w.isMetaMask ? "MetaMask" : w.hasInjected ? "Browser wallet" : "MetaMask"}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted" title={w.address ?? undefined}>
                {w.isConnected ? shortAddress(w.address) : w.hasInjected ? "Wallet detected — not connected" : "No wallet detected in this browser"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!w.isConnected ? (
              <>
                <Button variant="primary" loading={w.connecting} onClick={w.connect} icon={<ShieldCheck aria-hidden className="size-4" />}>
                  {w.connecting ? "Awaiting wallet…" : "Connect wallet"}
                </Button>
                <Button onClick={w.enterDemo} icon={<FlaskConical aria-hidden className="size-4" />}>
                  Demo mode
                </Button>
              </>
            ) : (
              <>
                <Button onClick={copy} icon={copied ? <Check aria-hidden className="size-4 text-ok" /> : <Copy aria-hidden className="size-4" />}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="danger" onClick={() => void w.disconnect()} icon={<LogOut aria-hidden className="size-4" />}>
                  {w.isDemo ? "Exit demo" : "Disconnect"}
                </Button>
              </>
            )}
          </div>
        </div>

        <WalletError />

        {w.isConnected && !w.isDemo && !w.onExpectedChain && (
          <Alert
            role="alert"
            tone="warn"
            icon={<AlertTriangle aria-hidden className="size-4" />}
            title="Wrong network"
            actions={
              <Button size="sm" variant="primary" icon={<Network aria-hidden className="size-3.5" />} onClick={w.switchNetwork}>
                Switch to {PORTAL_V3.shortName}
              </Button>
            }
          >
            Your wallet is on <span className="font-mono text-fg">{w.networkName}</span> (chain {w.chainId}). MissionEV needs{" "}
            {PORTAL_V3.name} (chain <span className="font-mono text-fg">{PORTAL_V3.chainId}</span>).
          </Alert>
        )}

        {w.isDemo && (
          <Alert tone="warn" icon={<FlaskConical aria-hidden className="size-4" />} title="DEMO MODE — no real wallet">
            This identity is simulated in your browser. No wallet, signature or blockchain activity is involved; everything you register is flagged DEMO DATA.
          </Alert>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-line bg-bg-2/60 p-4 lg:grid-cols-4">
          <KV label="Address" mono>
            {w.isConnected ? shortAddress(w.address) : "—"}
          </KV>
          <KV label="Network">{w.isConnected ? (w.isDemo ? `${PORTAL_V3.name} (demo)` : w.networkName) : "—"}</KV>
          <KV label="Chain ID" mono>
            {w.chainId ?? "—"}
          </KV>
          <KV label="Connected at">{formatTimestamp(w.connectedAt)}</KV>
        </dl>
      </div>
    </Panel>
  );
}
