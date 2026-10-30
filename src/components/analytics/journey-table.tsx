"use client";

import { useMemo, useState } from "react";
import { Route } from "lucide-react";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/format";
import { formatKm } from "@/lib/analytics/format";
import { MODES } from "@/lib/analytics/modes";
import { labelDay } from "@/lib/analytics/time";
import type { Journey } from "@/lib/analytics/types";
import { EmptyState } from "./chart-kit";

type StatusFilter = "all" | "verified" | "unverified";
const PAGE = 10;
const sel = "h-10 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg hover:border-line-strong focus-visible:border-cyan/60 focus-visible:ring-2 focus-visible:ring-cyan/30 focus-visible:outline-none";

const gramText = (g: number) => (g >= 1000 ? `${formatNumber(g / 1000, 2)} kg` : `${formatNumber(Math.round(g))} g`);

export function JourneyTable({ journeys, aliasOf, modeLabel, onReset }: { journeys: Journey[]; aliasOf: (key: string) => string; modeLabel: string; onReset: () => void }) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const list = journeys.filter((j) => status === "all" || (status === "verified" ? j.verified : !j.verified));
    return list.sort((a, b) => b.day - a.day || (a.id < b.id ? -1 : 1));
  }, [journeys, status]);
  const shown = rows.slice(0, limit);

  const origin = (j: Journey) => (j.origin === "demo" ? "Demo" : j.simulated ? "Session · simulated" : "Session · GPS");
  const stat = (j: Journey) => <Badge tone={j.verified ? "ok" : "err"}>{j.verified ? "Verified" : "Unverified"}</Badge>;

  return (
    <Panel aria-labelledby="journeys-title" data-section="journeys">
      <PanelHeader
        id="journeys-title"
        eyebrow="D2 · Trips & telemetry (aggregate view)"
        title="Journey ledger"
        subtitle={`${modeLabel} · no coordinates or vehicle registration numbers are shown. Unverified journeys never count toward impact totals.`}
      />
      <div className="grid grid-cols-1 gap-3 border-b border-line px-4 py-4 sm:px-6 lg:max-w-md">
        <label className="block">
          <span className="section-label mb-1.5 block">Verification status</span>
          <select
            className={sel}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setLimit(PAGE);
            }}
          >
            <option value="all">All journeys</option>
            <option value="verified">Verified only</option>
            <option value="unverified">Unverified only</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No journeys match these filters"
          text="Try another status, a wider date range, or a different mode."
          action={{
            label: "Reset filters",
            onClick: () => {
              setStatus("all");
              onReset();
            },
          }}
        />
      ) : (
        <>
          {/* xl+: full table; below that a card list (2-up on tablets) so nothing scrolls sideways */}
          <div className="hidden xl:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Date", "Commuter", "Mode", "Distance", "Est. emissions", "Avoided", "$MEV", "Status", "Origin"].map((h, i) => (
                    <th key={h} scope="col" className={cn("section-label px-4 py-3 font-semibold xl:px-6", i >= 3 && i <= 6 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {shown.map((j) => (
                  <tr key={j.id} data-journey-row data-mode={j.mode} className={cn(j.userKey === "you" ? "bg-lime/[0.05]" : "hover:bg-fg/[0.02]")}>
                    <td className="px-4 py-3 font-mono text-xs text-muted xl:px-6">{labelDay(j.day)}</td>
                    <td className="px-4 py-3 text-fg xl:px-6">{aliasOf(j.userKey)}</td>
                    <td className="px-4 py-3 xl:px-6">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: MODES[j.mode].color }} />
                        {MODES[j.mode].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono xl:px-6">{formatKm(j.distanceKm)} km</td>
                    <td className="px-4 py-3 text-right font-mono xl:px-6">{j.verified ? gramText(j.actualG) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-lime xl:px-6">{j.verified ? gramText(j.avoidedG) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono xl:px-6">{j.verified ? formatNumber(j.tokens) : "—"}</td>
                    <td className="px-4 py-3 xl:px-6">{stat(j)}</td>
                    <td className="px-4 py-3 text-xs text-muted xl:px-6">{origin(j)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-y-0 xl:hidden">
            {shown.map((j) => (
              <li key={j.id} data-journey-card data-mode={j.mode} className={cn("grid grid-cols-2 content-start gap-x-4 gap-y-2 border-line px-4 py-4 md:border-b md:odd:border-r", j.userKey === "you" && "bg-lime/[0.05]")}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-fg">
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: MODES[j.mode].color }} />
                    <span className="truncate">{MODES[j.mode].label}</span>
                  </p>
                  <p className="truncate text-xs text-muted">{aliasOf(j.userKey)}</p>
                </div>
                <p className="text-right font-mono text-fg">{formatKm(j.distanceKm)} km</p>
                <p className="font-mono text-[11px] text-muted">
                  {labelDay(j.day)} · {origin(j)}
                </p>
                <div className="flex justify-end">{stat(j)}</div>
                {j.verified && (
                  <p className="col-span-2 flex flex-wrap gap-x-4 text-xs text-muted">
                    <span>Est. {gramText(j.actualG)}</span>
                    <span className="text-lime">Avoided {gramText(j.avoidedG)}</span>
                    <span>{formatNumber(j.tokens)} $MEV</span>
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:px-6">
            <p className="flex items-center gap-2">
              <Route aria-hidden className="size-3.5" />
              Showing {formatNumber(shown.length)} of {formatNumber(rows.length)} journeys
            </p>
            {rows.length > limit && (
              <Button size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                Show {Math.min(PAGE, rows.length - limit)} more
              </Button>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
