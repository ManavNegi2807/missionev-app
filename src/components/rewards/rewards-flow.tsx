"use client";

import { ArrowRight, Database, Server, Ticket } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { useRewards } from "@/providers/rewards-provider";

/** Level 1 · process 6.0: D3 Smart-contract Ledger → Rewards & Redeem → D4 Redemptions → Commuter voucher. */
export function RewardsFlow() {
  const { onchainActive, redemptions, summary } = useRewards();
  const vouchers = redemptions.filter((r) => r.voucher).length;
  const nodes = [
    { n: "D3 Smart-contract Ledger", sub: onchainActive ? "live contract reads" : "demo credits (not connected)", icon: <Database className="size-4" />, store: true },
    { n: "6.0 Rewards & Redeem", sub: `${summary.balance} $MEV available`, icon: <Server className="size-4" />, store: false },
    { n: "D4 Redemptions", sub: `${redemptions.length} local record${redemptions.length === 1 ? "" : "s"}`, icon: <Database className="size-4" />, store: true },
    { n: "Commuter voucher", sub: `${vouchers} demo voucher${vouchers === 1 ? "" : "s"}`, icon: <Ticket className="size-4" />, store: false },
  ];
  return (
    <Panel aria-labelledby="flow3-title">
      <PanelHeader id="flow3-title" eyebrow="Data flow · Level 1" title="Ledger → rewards → redemptions → voucher" />
      <ol className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
        {nodes.map((nd, i) => (
          <li key={nd.n} className={cn("relative flex items-center gap-3 rounded-lg border bg-bg-2/60 p-3", nd.store ? "border-lime/25" : "border-line")}>
            <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-md border", nd.store ? "border-lime/40 text-lime" : "border-line-strong text-cyan")}>
              {nd.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-tight font-medium text-fg">{nd.n}</p>
              <p className="text-[11px] leading-tight text-muted">{nd.sub}</p>
            </div>
            {i < nodes.length - 1 && <ArrowRight aria-hidden className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-panel text-line-strong xl:block" />}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
