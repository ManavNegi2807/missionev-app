"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/format";
import { formatKm, massText, pct } from "@/lib/analytics/format";
import { MODES, type ModeId } from "@/lib/analytics/modes";
import type { ModeSlice } from "@/lib/analytics/selectors";
import { ChartTip, EmptyState, SourceBadge, TipRow, useReducedMotion, type SourceKind } from "./chart-kit";

function Tip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: ModeSlice }> }) {
  const s = active ? payload?.[0]?.payload : undefined;
  if (!s) return null;
  return (
    <ChartTip title={s.label}>
      <TipRow color={s.color} label="Verified trips" value={formatNumber(s.trips)} />
      <TipRow label="Share" value={pct(s.share)} />
      <TipRow label="Distance" value={`${formatKm(s.distanceKm)} km`} />
      <TipRow label="Est. emissions" value={massText(s.actualG)} />
      <p className="border-t border-line pt-1.5 text-[11px] text-muted">Click to filter charts and the journey table</p>
    </ChartTip>
  );
}

export function ModeDonut({ slices, total, selected, onSelect, source, scopeNote }: { slices: ModeSlice[]; total: number; selected: ModeId | "all"; onSelect: (m: ModeId | "all") => void; source: SourceKind; scopeNote: string }) {
  const reduced = useReducedMotion();
  const shown = slices.filter((s) => s.trips > 0);
  const pick = (m: ModeId) => onSelect(selected === m ? "all" : m);
  const sel = selected === "all" ? null : slices.find((s) => s.mode === selected);

  return (
    <Panel aria-labelledby="chart-mode-title" data-chart="modes" className="@container flex flex-col">
      <PanelHeader id="chart-mode-title" eyebrow="Chart 2 · Transport mix" title="Transport mode distribution" subtitle={`${scopeNote} · verified journeys`} action={<SourceBadge kind={source} />} />
      {total === 0 ? (
        <EmptyState title="No verified journeys in this view" text="There is nothing to split by mode for the selected date range and scope." />
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 p-4 sm:p-6 @xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] @xl:items-center">
          <div className="relative mx-auto h-[230px] w-full max-w-[280px]" role="img" aria-label={`Donut chart of verified journeys by transport mode. ${shown.map((s) => `${s.label} ${pct(s.share)}`).join(", ")}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shown}
                  dataKey="trips"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="94%"
                  paddingAngle={shown.length > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive={!reduced}
                  animationDuration={450}
                  onClick={(_, i) => shown[i] && pick(shown[i].mode)}
                >
                  {shown.map((s) => (
                    <Cell key={s.mode} fill={s.color} fillOpacity={selected === "all" || selected === s.mode ? 1 : 0.25} style={{ cursor: "pointer", outline: "none" }} data-slice={s.mode} />
                  ))}
                </Pie>
                <Tooltip content={Tip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="font-mono text-2xl font-semibold text-fg" data-donut-total>
                  {formatNumber(sel ? sel.trips : total)}
                </p>
                <p className="section-label mt-0.5 max-w-[7rem]">{sel ? sel.label : "Verified journeys"}</p>
              </div>
            </div>
          </div>

          <ul className="space-y-1.5" aria-label="Transport modes (select to filter)">
            {slices.map((s) => (
              <li key={s.mode}>
                <button
                  type="button"
                  data-mode-row={s.mode}
                  aria-pressed={selected === s.mode}
                  onClick={() => pick(s.mode)}
                  disabled={s.trips === 0}
                  className={cn(
                    "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
                    selected === s.mode ? "border-lime/50 bg-lime/[0.06]" : "border-line hover:border-line-strong hover:bg-fg/[0.03]",
                  )}
                >
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-fg">{s.label}</span>
                    <span className="block text-[11px] leading-snug text-muted">
                      {formatNumber(s.trips)} trips · {formatKm(s.distanceKm)} km · {massText(s.actualG)}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-fg">{pct(s.share)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted sm:px-6">
        <span>{sel ? `Filtering by ${sel.label} — ${MODES[sel.mode].note}` : "Select a segment to filter the charts and journey table."}</span>
        {selected !== "all" && (
          <Button size="sm" variant="ghost" onClick={() => onSelect("all")}>
            Clear mode filter
          </Button>
        )}
      </div>
    </Panel>
  );
}
