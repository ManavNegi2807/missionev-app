"use client";

import { Check, Circle, ExternalLink, Minus } from "lucide-react";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { PORTAL_V3 } from "@/lib/chain";
import { cn, formatNumber, shortAddress } from "@/lib/format";
import { CONTRACT } from "@/lib/contract/config";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useRewards } from "@/providers/rewards-provider";

const stamp = (ms: number | null) => (ms ? new Date(ms).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "time unavailable");
const txLink = (h: string) => (PORTAL_V3.explorerUrl ? `${PORTAL_V3.explorerUrl.replace(/\/$/, "")}/tx/${h}` : null);

function Check1({ ok, label, hint }: { ok: boolean | null; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span aria-hidden className="mt-0.5 shrink-0">
        {ok === true ? <Check className="size-4 text-ok" /> : ok === false ? <Minus className="size-4 text-err" /> : <Circle className="size-4 text-muted" />}
      </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span className={cn(ok === true ? "text-fg" : "text-muted")}>{label}</span>
        <span className="sr-only">{ok === true ? " — yes" : ok === false ? " — no" : " — not checked"}</span>
        {hint && <span className="block font-mono text-[10.5px] text-muted/80">{hint}</span>}
      </span>
    </li>
  );
}

export function OnchainActivity() {
  const { checks, onchainActive, chainEvents, onchain, chainError, summary, redemptions, refreshing } = useRewards();
  const { registration } = useOnboarding();

  const illustrative = [
    ...summary.events.map((e) => ({ id: e.id, at: e.at, title: e.label, amount: `+${formatNumber(e.amount)}`, status: e.status, wallet: registration?.wallet.address ?? "" })),
    ...redemptions
      .filter((r) => r.mode === "demo")
      .map((r) => ({ id: r.id, at: r.createdAt, title: `Redeemed · ${r.itemName}`, amount: `−${formatNumber(r.amount)}`, status: "Simulated redemption", wallet: r.wallet.address })),
  ].sort((a, b) => b.at - a.at);

  return (
    <Panel aria-labelledby="chain-title">
      <PanelHeader
        id="chain-title"
        eyebrow="Process 6.0 ← D3 Smart-contract Ledger"
        title="Portal Layer 0 / token activity"
        subtitle="Real contract events appear only when a deployed contract and a real wallet on Portal V3 are configured."
        action={
          <Badge tone={onchainActive ? "ok" : "warn"} dot>
            {onchainActive ? "Live contract reads" : "Not connected — illustrative only"}
          </Badge>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <p className="section-label mb-3">Live-read requirements</p>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-2">
            <Check1 ok={checks.addressConfigured} label="Deployed contract address configured" hint={checks.addressConfigured ? CONTRACT.address : "NEXT_PUBLIC_MEV_CONTRACT_ADDRESS is empty"} />
            <Check1 ok={checks.realWallet} label="Real browser wallet connected (not demo)" />
            <Check1 ok={checks.addressConfigured && checks.realWallet ? checks.onPortal : checks.realWallet ? checks.onPortal : false} label={`Wallet on ${PORTAL_V3.name} (chain ${PORTAL_V3.chainId})`} />
            <Check1 ok={checks.codeFound} label="Contract code found at the address" />
            <Check1 ok={checks.balanceReadable} label="$MEV balance readable via balanceOf" />
          </ul>
          {chainError && <p className="mt-3 text-xs text-err [overflow-wrap:anywhere]">Read error: {chainError}</p>}
        </div>

        {onchainActive && (
          <div data-section="real-events">
            <p className="section-label mb-3 flex items-center gap-2">
              Actual contract events <Badge tone="ok">On-chain</Badge>
            </p>
            {onchain?.eventsError ? (
              <p className="rounded-lg border border-line p-3 text-sm text-muted">Event history unavailable from this RPC: {onchain.eventsError}</p>
            ) : chainEvents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">{refreshing ? "Reading events…" : "No $MEV events found for this wallet yet."}</p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {chainEvents.map((e) => (
                  <li key={e.id} data-chain-event={e.kind} className="space-y-1.5 px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-fg">{e.kind === "reward" ? "Commute recorded (minted)" : e.kind === "transfer-out" ? "Transferred out" : "Transferred in"}</p>
                      <p className={cn("font-mono text-sm", e.kind === "transfer-out" ? "text-cyan" : "text-lime")}>
                        {e.kind === "transfer-out" ? "−" : "+"}
                        {formatNumber(e.amount)} $MEV
                      </p>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{stamp(e.at)}</span>
                      <span className="font-mono">{shortAddress(e.wallet)}</span>
                      <Badge tone="ok">Confirmed log</Badge>
                    </p>
                    <p className="font-mono text-[11px] break-all text-muted">
                      {e.txHash}{" "}
                      {txLink(e.txHash) && (
                        <a href={txLink(e.txHash)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan hover:underline">
                          explorer <ExternalLink aria-hidden className="size-3" />
                        </a>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div data-section="illustrative-events">
          <p className="section-label mb-3 flex flex-wrap items-center gap-2">
            Illustrative session records <Badge tone="warn">Not on-chain</Badge>
          </p>
          {illustrative.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">
              No records yet. Verify a trip and preview its on-chain record on Screen 02, or add demo $MEV above.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {illustrative.slice(0, 12).map((e) => (
                <li key={`${e.id}-${e.title}`} className="space-y-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-fg">{e.title}</p>
                    <p className="font-mono text-sm text-fg">{e.amount} $MEV</p>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>{stamp(e.at)}</span>
                    <span className="font-mono">{e.wallet ? shortAddress(e.wallet) : "—"}</span>
                    <Badge tone="warn">{e.status}</Badge>
                    <span>Tx hash: none</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}
