"use client";

import { Coins, Fuel, FlaskConical, Plus, RefreshCw } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { PORTAL_V3 } from "@/lib/chain";
import { formatClock, formatNumber, shortAddress } from "@/lib/format";
import { formatNative } from "@/lib/rewards/chain";
import { useRewards } from "@/providers/rewards-provider";
import { useWallet } from "@/providers/wallet-provider";

function Mini({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-bg-2/60 p-3">
      <p className="section-label truncate">{label}</p>
      <p className="mt-1.5 truncate font-mono text-lg font-semibold text-fg">
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-1 truncate text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

export function TokenOverview() {
  const { summary: s, onchainActive, grantDemo, refreshOnchain, refreshing, gasWei, checks, chainError } = useRewards();
  const wallet = useWallet();

  const gasReason = wallet.isDemo
    ? "Demo mode has no real wallet, so there is no tPOT balance to read."
    : !wallet.isConnected
      ? "Connect a real wallet on Portal V3 to read your tPOT balance."
      : !wallet.onExpectedChain
        ? `Switch your wallet to ${PORTAL_V3.name} (chain ${PORTAL_V3.chainId}) to read tPOT.`
        : refreshing
          ? "Reading balance…"
          : "The wallet did not return a balance.";

  const last = s.lastEvent;

  return (
    <section aria-label="Token accounts" className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Panel aria-labelledby="mev-title" className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-lime/[0.07] blur-3xl" />
        <header className="relative flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="section-label mb-1 flex items-center gap-2">
              <Coins aria-hidden className="size-3.5 text-lime" /> $MEV · project reward token
            </p>
            <h2 id="mev-title" className="text-[15px] font-semibold tracking-[0.06em] uppercase">
              MissionEV reward balance
            </h2>
          </div>
          {onchainActive ? (
            <Badge tone="ok" dot>
              On-chain · balanceOf
            </Badge>
          ) : (
            <Badge tone="warn" dot>
              Demo balance — not a live token balance
            </Badge>
          )}
        </header>

        <div className="relative space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-label">Available</p>
              <p className="mt-1 font-mono text-5xl leading-none font-semibold text-lime sm:text-6xl" data-testid="balance">
                <AnimatedNumber value={s.balance} decimals={0} />
                <span className="ml-2 text-lg font-normal text-muted">$MEV</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onchainActive ? (
                <Button size="sm" loading={refreshing} icon={<RefreshCw aria-hidden className="size-3.5" />} onClick={() => void refreshOnchain()}>
                  Refresh
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus aria-hidden className="size-3.5" />}
                  onClick={() => grantDemo(100)}
                  title="Adds 100 demo $MEV to this browser session only. Nothing is minted."
                >
                  Add demo $MEV (+100)
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Mini label="Total earned" value={formatNumber(s.earned)} unit="$MEV" sub={onchainActive ? "sum of TripRecorded events" : "demo credits"} />
            <Mini label="Total redeemed" value={formatNumber(s.redeemed)} unit="$MEV" sub={onchainActive ? "sum of Redeemed events" : "simulated"} />
            <Mini label="Pending" value={formatNumber(s.pending)} unit="$MEV" sub="verified, not recorded yet" />
            <Mini
              label="Latest reward event"
              value={last ? `+${formatNumber(last.amount)}` : "—"}
              unit={last ? "$MEV" : undefined}
              sub={last ? `${last.label}${last.at ? ` · ${formatClock(last.at)}` : ""}` : "none yet"}
            />
          </div>

          {!onchainActive && (
            <p className="text-xs leading-relaxed text-muted">
              Demo balance = tokens from trips whose on-chain record you previewed on Screen 02, plus any demo top-ups, minus simulated redemptions. Nothing here is minted or held by a wallet.
              {chainError && <span className="mt-1 block text-err">Contract read failed: {chainError}</span>}
            </p>
          )}
          {!onchainActive && checks.addressConfigured && checks.onPortal && checks.codeFound === false && (
            <p className="text-xs text-warn">The configured address has no contract code on this network, so demo mode stays active.</p>
          )}
        </div>
      </Panel>

      <Panel aria-labelledby="gas-title">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="section-label mb-1 flex items-center gap-2">
              <Fuel aria-hidden className="size-3.5 text-cyan" /> tPOT · native gas currency
            </p>
            <h2 id="gas-title" className="text-[15px] font-semibold tracking-[0.06em] uppercase">
              Portal testnet gas balance
            </h2>
          </div>
          <Badge tone={gasWei ? "ok" : "neutral"}>{gasWei ? "On-chain" : "Unavailable"}</Badge>
        </header>
        <div className="space-y-4 p-4 sm:p-6">
          <p className="font-mono text-3xl leading-none font-semibold text-cyan" data-testid="gas">
            {gasWei ? formatNative(gasWei) : "—"}
            <span className="ml-2 text-sm font-normal text-muted">tPOT</span>
          </p>
          {!gasWei && <p className="text-sm text-muted">{gasReason}</p>}
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="section-label">Network</dt>
              <dd className="mt-1 truncate text-fg">{wallet.isConnected ? (wallet.isDemo ? `${PORTAL_V3.name} (demo)` : wallet.networkName) : PORTAL_V3.name}</dd>
            </div>
            <div>
              <dt className="section-label">Wallet</dt>
              <dd className="mt-1 truncate font-mono text-fg">{wallet.isConnected ? shortAddress(wallet.address) : "—"}</dd>
            </div>
          </dl>
          <div className="flex gap-2 rounded-lg border border-line bg-bg-2/50 p-3 text-xs leading-relaxed text-muted">
            <FlaskConical aria-hidden className="mt-0.5 size-3.5 shrink-0 text-cyan" />
            <p>
              <span className="text-fg">tPOT pays gas, not rewards.</span> It is separate from $MEV and never counts toward your reward balance.
            </p>
          </div>
        </div>
      </Panel>
    </section>
  );
}
