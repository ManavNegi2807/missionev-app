"use client";

import { useMemo, useState } from "react";
import { History, ListFilter, RotateCcw } from "lucide-react";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { GROUPS } from "@/lib/rewards/catalog";
import type { RedemptionRecord, RedemptionStatus } from "@/lib/rewards/types";
import { useRewards } from "@/providers/rewards-provider";

export const STATUS_TONE: Record<RedemptionStatus, "cyan" | "ok" | "err" | "warn"> = { pending: "cyan", completed: "ok", failed: "err", simulated: "warn" };
const label = (s: RedemptionStatus) => s.charAt(0).toUpperCase() + s.slice(1);
const when = (ms: number) => new Date(ms).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function HistorySection({ onOpen }: { onOpen: (id: string) => void }) {
  const { redemptions, clearSimulated } = useRewards();
  const [status, setStatus] = useState<RedemptionStatus | "all">("all");
  const [group, setGroup] = useState<string>("all");

  const rows = useMemo(
    () => redemptions.filter((r) => (status === "all" || r.status === status) && (group === "all" || r.group === group)),
    [redemptions, status, group],
  );
  const filtered = status !== "all" || group !== "all";

  const sel = "h-10 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg hover:border-line-strong focus-visible:border-cyan/60 focus-visible:ring-2 focus-visible:ring-cyan/30 focus-visible:outline-none";

  return (
    <Panel aria-labelledby="hist-title">
      <PanelHeader
        id="hist-title"
        eyebrow="D4 · Redemptions"
        title="Redemption history"
        subtitle="Local records for this browser tab. Select a row for its transaction / detail drawer."
        action={
          redemptions.some((r) => r.mode === "demo") ? (
            <Button size="sm" variant="ghost" icon={<RotateCcw aria-hidden className="size-3.5" />} onClick={clearSimulated}>
              Reset demo data
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-3 border-b border-line px-4 py-4 sm:grid-cols-2 sm:px-6 lg:max-w-2xl">
        <label className="block">
          <span className="section-label mb-1.5 flex items-center gap-1.5">
            <ListFilter aria-hidden className="size-3" /> Status
          </span>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value as RedemptionStatus | "all")}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="simulated">Simulated</option>
          </select>
        </label>
        <label className="block">
          <span className="section-label mb-1.5 block">Reward category</span>
          <select className={sel} value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">All categories</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <History aria-hidden className="size-8 text-muted" />
          <p className="text-sm font-medium text-fg">{filtered ? "No redemptions match these filters." : "No redemptions yet."}</p>
          <p className="max-w-sm text-sm text-muted">{filtered ? "Try another status or category." : "Redeem a reward above and its D4 record will appear here."}</p>
          {filtered && (
            <Button
              size="sm"
              onClick={() => {
                setStatus("all");
                setGroup("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* md+: real table inside a horizontal scroller */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Reward", "Date", "Amount", "Status", "Reference", "Action"].map((h) => (
                    <th key={h} scope="col" className="section-label px-6 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rows.map((r) => (
                  <tr key={r.id} data-history-row={r.id} className="hover:bg-fg/[0.02]">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-fg">{r.itemName}</p>
                      <p className="text-xs text-muted">{r.category}</p>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-muted">{when(r.createdAt)}</td>
                    <td className="px-6 py-3.5 font-mono text-fg">{formatNumber(r.amount)} $MEV</td>
                    <td className="px-6 py-3.5">
                      <Badge tone={STATUS_TONE[r.status]}>{label(r.status)}</Badge>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-fg">{r.id}</td>
                    <td className="px-6 py-3.5">
                      <Button size="sm" aria-label={`Details for ${r.id}`} onClick={() => onOpen(r.id)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* <md: card list instead of a squeezed table */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((r) => (
              <li key={r.id} data-history-card={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} aria-label={`Details for ${r.id}`} className="grid w-full grid-cols-2 gap-x-4 gap-y-2 px-4 py-4 text-left hover:bg-fg/[0.03]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{r.itemName}</p>
                    <p className="truncate text-xs text-muted">{r.category}</p>
                  </div>
                  <p className="text-right font-mono text-fg">{formatNumber(r.amount)} $MEV</p>
                  <p className="font-mono text-[11px] text-muted">{when(r.createdAt)}</p>
                  <div className="flex justify-end">
                    <Badge tone={STATUS_TONE[r.status]}>{label(r.status)}</Badge>
                  </div>
                  <p className="col-span-2 truncate font-mono text-[11px] text-muted">{r.id}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

export const recordLabel = label;
export type { RedemptionRecord };
