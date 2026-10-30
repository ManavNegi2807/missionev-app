"use client";

import { useState } from "react";
import { AlertTriangle, Fuel, Link2, Coins, Loader2 } from "lucide-react";
import { Alert, Badge, Button, KV, Panel } from "@/components/ui/primitives";
import { PORTAL_V3 } from "@/lib/chain";
import { cn, shortAddress } from "@/lib/format";
import { CONTRACT, contractStatus } from "@/lib/trip/ledger";
import { useTrip } from "@/providers/trip-provider";
import { useWallet } from "@/providers/wallet-provider";

const PHASES = ["pending", "confirmed", "failed"] as const;

export function LedgerPanel() {
  const { record, status, previewLedger } = useTrip();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const cs = contractStatus();

  const verified = status === "VERIFIED" && Boolean(record?.emissions);
  const ledger = record?.ledger;
  const preview = ledger?.preview;
  const address = record?.wallet.address ?? wallet.address;
  const chainId = wallet.isConnected ? wallet.chainId : (record?.wallet.chainId ?? null);
  const wrongChain = wallet.isConnected && !wallet.isDemo && !wallet.onExpectedChain;

  return (
    <Panel aria-labelledby="ledger-title" className="border-lime/20">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="section-label mb-1">Process 5.0 · Record on-chain → D3</p>
          <h2 id="ledger-title" className="text-[15px] font-semibold tracking-[0.06em] uppercase">
            Portal Layer 0 / smart contract ledger
          </h2>
        </div>
        <Badge tone="warn" dot>
          Preview only
        </Badge>
      </header>

      <div className="space-y-5 p-4 sm:p-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <KV label="Selected wallet" mono>
            {address ? shortAddress(address) : "—"}
          </KV>
          <KV label="Portal network">{wallet.isConnected ? (wallet.isDemo ? `${PORTAL_V3.name} (demo)` : wallet.networkName) : PORTAL_V3.name}</KV>
          <KV label="Chain ID" mono>
            {chainId ?? "—"} <span className="text-muted">/ {PORTAL_V3.chainId}</span>
          </KV>
          <KV label="Contract">
            <span className="text-warn">{cs.label}</span>
          </KV>
        </dl>

        {wrongChain && (
          <Alert tone="warn" role="alert" icon={<AlertTriangle aria-hidden className="size-4" />} title="Wrong network">
            Your wallet is on chain {wallet.chainId}; Portal V3 is {PORTAL_V3.chainId}. Switch it from Screen 01 before any on-chain step.
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-bg-2/60 p-3.5">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted">
              <Fuel aria-hidden className="size-4" /> GAS · {CONTRACT.gasSymbol}
            </p>
            <p className="mt-2 text-sm text-fg">Native currency of Portal V3 testnet.</p>
            <p className="mt-1 text-xs text-muted">In the contract design the oracle service pays gas for submitTrip — not the commuter.</p>
          </div>
          <div className="rounded-xl border border-line bg-bg-2/60 p-3.5">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted">
              <Coins aria-hidden className="size-4" /> REWARD · {CONTRACT.rewardSymbol}
            </p>
            <p className="mt-2 font-mono text-lg text-lime">
              {record?.emissions ? record.emissions.tokens : "—"} <span className="text-xs text-muted">{CONTRACT.rewardSymbol} (illustrative)</span>
            </p>
            <p className="mt-1 text-xs text-muted">Not minted. Contract source names its token {CONTRACT.contractTokenSymbol}.</p>
          </div>
        </div>

        <div>
          <p className="section-label mb-2">Transaction state</p>
          <ol className="grid grid-cols-3 gap-2" aria-label="Transaction states">
            {PHASES.map((p) => (
              <li key={p} className={cn("rounded-lg border px-2 py-2 text-center font-mono text-[11px] tracking-[0.1em] uppercase", ledger?.phase === p ? "border-lime/50 text-lime" : "border-line text-muted/60")}>
                {p}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">
            {ledger?.phase === "previewed" ? "No transaction was submitted. This is a local preview." : "No transaction submitted."} Tx hash:{" "}
            <span className="font-mono text-fg">{ledger?.txHash ?? "— (none; a hash appears only when a real transaction returns one)"}</span>
          </p>
        </div>

        <Alert tone="neutral" icon={<Link2 aria-hidden className="size-4" />} title="Why real recording is disabled">
          <p>{cs.detail}</p>
          <p className="mt-2">
            In the project’s design, <span className="font-mono text-fg">submitTrip</span> is callable only by the backend “oracle” reward service after it re-verifies the
            trip — a commuter’s wallet would revert with “not oracle”. Add the deployed address and wire the reward-service endpoint to enable it.
          </p>
        </Alert>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!verified || busy}
          loading={busy}
          icon={<Link2 aria-hidden className="size-4" />}
          onClick={async () => {
            setBusy(true);
            try {
              await previewLedger();
            } finally {
              setBusy(false);
            }
          }}
        >
          Preview on-chain record — demo only
        </Button>
        {!verified && <p className="-mt-2 text-center text-xs text-muted">Available after a trip is verified.</p>}
        {busy && (
          <p role="status" className="flex items-center justify-center gap-2 text-xs text-muted">
            <Loader2 aria-hidden className="size-3.5 animate-spin" /> Building payload…
          </p>
        )}

        {ledger?.unavailableReason && (
          <Alert tone="warn" role="alert" icon={<AlertTriangle aria-hidden className="size-4" />} title="No preview available">
            {ledger.unavailableReason}
          </Alert>
        )}

        {preview && (
          <div className="space-y-3 rounded-xl border border-warn/30 bg-warn/[0.04] p-4">
            <p className="font-mono text-[11px] tracking-[0.14em] text-warn">PREVIEW — DEMO ONLY · NOT SUBMITTED</p>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <KV label="Function" mono>
                submitTrip ({preview.selector})
              </KV>
              <KV label="Trust tier → enum" mono>
                {preview.trustTier} → {preview.trustIndex}
              </KV>
              <KV label="Vehicle ID" mono>
                {preview.vehicleId}
              </KV>
              <KV label="Distance (m)" mono>
                {preview.distanceMeters}
              </KV>
            </dl>
            <div className="min-w-0">
              <p className="section-label">Trip hash · keccak256 (no raw GPS)</p>
              <p className="mt-1 font-mono text-[11px] break-all text-fg">{preview.tripHash}</p>
            </div>
            <div className="min-w-0">
              <p className="section-label">ABI-encoded calldata the oracle would send</p>
              <p className="mt-1 max-h-24 overflow-y-auto font-mono text-[11px] break-all text-muted">{preview.calldata}</p>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
