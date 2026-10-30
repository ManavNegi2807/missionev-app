"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/format";
import { formatKm, massText } from "@/lib/analytics/format";
import type { DayCell, HeatGrid } from "@/lib/analytics/selectors";
import { labelDay, labelDayLong, WEEKDAYS } from "@/lib/analytics/time";
import { EmptyState, SourceBadge, type SourceKind } from "./chart-kit";

const LEVEL_BG = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const levelOf = (n: number, max: number) => (n <= 0 || max <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4))));
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ActivityHeatmap({ grid, source, scopeNote, onReset }: { grid: HeatGrid; source: SourceKind; scopeNote: string; onReset: () => void }) {
  const { weeks, max } = grid;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastReal = (() => {
    for (let w = weeks.length - 1; w >= 0; w--) for (let d = 6; d >= 0; d--) if (!weeks[w][d].blank) return w * 7 + d;
    return 0;
  })();
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [active, setActive] = useState<DayCell | null>(null);
  const roving = focusIdx ?? lastReal;

  const move = (idx: number, key: string): number | null => {
    const w = Math.floor(idx / 7);
    const d = idx % 7;
    const target = key === "ArrowDown" ? [w, d + 1] : key === "ArrowUp" ? [w, d - 1] : key === "ArrowRight" ? [w + 1, d] : key === "ArrowLeft" ? [w - 1, d] : null;
    if (!target) return null;
    const [tw, td] = target;
    if (tw < 0 || tw >= weeks.length || td < 0 || td > 6 || weeks[tw][td].blank) return null;
    return tw * 7 + td;
  };
  const onKey = (e: KeyboardEvent, idx: number) => {
    const next = move(idx, e.key);
    if (next === null) return;
    e.preventDefault();
    setFocusIdx(next);
    setActive(weeks[Math.floor(next / 7)][next % 7]);
    refs.current[next]?.focus();
  };

  const quarter = (i: number) => Math.round((max * i) / 4);
  const legend = [
    { l: 0, text: "0" },
    { l: 1, text: `1–${Math.max(1, quarter(1))}` },
    { l: 2, text: `${Math.max(1, quarter(1)) + 1}–${Math.max(2, quarter(2))}` },
    { l: 3, text: `${Math.max(2, quarter(2)) + 1}–${Math.max(3, quarter(3))}` },
    { l: 4, text: `${Math.max(3, quarter(3)) + 1}–${max}` },
  ];

  return (
    <Panel aria-labelledby="chart-heat-title" data-chart="heatmap">
      <PanelHeader id="chart-heat-title" eyebrow="Chart 4 · Daily activity" title="Daily mobility activity" subtitle={`${scopeNote} · verified journeys per day`} action={<SourceBadge kind={source} />} />
      {max === 0 ? (
        <EmptyState title="No verified journeys in this view" text="No daily activity to draw for the selected range, scope and mode." action={{ label: "Reset filters", onClick: onReset }} />
      ) : (
        <div className="space-y-4 p-4 sm:p-6">
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-2" style={{ minWidth: weeks.length * 20 + 32 }} role="group" aria-label="Calendar heatmap of verified journeys per day. Use arrow keys to move between days.">
              <div aria-hidden className="grid w-7 shrink-0 grid-rows-[16px_repeat(7,minmax(0,1fr))] gap-1 text-[11px] text-muted">
                <span />
                {WEEKDAYS.map((d, i) => (
                  <span key={d} className="flex items-center">
                    {i % 2 === 0 ? d : ""}
                  </span>
                ))}
              </div>
              <div className="flex min-w-0 flex-1 gap-1">
                {weeks.map((week, w) => {
                  const first = week.find((c) => !c.blank);
                  const m = first ? new Date(first.day).getMonth() : -1;
                  const prevFirst = w > 0 ? weeks[w - 1].find((c) => !c.blank) : null;
                  const newMonth = first && (!prevFirst || new Date(prevFirst.day).getMonth() !== m);
                  return (
                    <div key={week[0].day} className="grid max-w-[42px] min-w-[16px] flex-1 grid-rows-[16px_repeat(7,minmax(0,1fr))] gap-1">
                      <span aria-hidden className="overflow-visible text-[11px] leading-4 whitespace-nowrap text-muted">
                        {newMonth ? MONTH[m] : ""}
                      </span>
                      {week.map((c, d) => {
                        const idx = w * 7 + d;
                        if (c.blank) return <span key={c.day} aria-hidden className="aspect-square" />;
                        const lvl = levelOf(c.journeys, max);
                        return (
                          <button
                            key={c.day}
                            type="button"
                            ref={(el) => {
                              refs.current[idx] = el;
                            }}
                            data-day={c.day}
                            data-count={c.journeys}
                            data-level={lvl}
                            tabIndex={idx === roving ? 0 : -1}
                            aria-label={`${labelDayLong(c.day)}: ${c.journeys} verified ${c.journeys === 1 ? "journey" : "journeys"}${c.inRange ? "" : " (outside selected range)"}`}
                            onMouseEnter={() => setActive(c)}
                            onFocus={() => {
                              setFocusIdx(idx);
                              setActive(c);
                            }}
                            onClick={() => setActive(c)}
                            onKeyDown={(e) => onKey(e, idx)}
                            className={cn("aspect-square w-full rounded-[4px] border border-fg/[0.06] transition hover:ring-2 hover:ring-cyan/70", !c.inRange && "opacity-35", active?.day === c.day && "ring-2 ring-cyan")}
                            style={{ background: LEVEL_BG[lvl] }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div role="status" aria-live="polite" data-heat-readout className="rounded-lg border border-line bg-bg-2/60 px-3.5 py-3 text-sm">
            {active ? (
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <p className="font-medium text-fg">{labelDayLong(active.day)}</p>
                <p className="font-mono text-fg">
                  {formatNumber(active.journeys)} verified {active.journeys === 1 ? "journey" : "journeys"}
                </p>
                <p className="text-xs text-muted">
                  {formatKm(active.distanceKm)} km · {massText(active.avoidedG)} avoided · {formatNumber(active.tokens)} $MEV potential
                </p>
                {!active.inRange && <p className="text-xs text-warn">Outside the selected range (shown for context)</p>}
              </div>
            ) : (
              <p className="text-muted">Hover, focus or tap a day for its verified-journey count, distance and estimated avoided emissions.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted" aria-label="Legend">
            <span className="section-label">Legend · verified journeys per day</span>
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {legend.map((x) => (
                <li key={x.l} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-3.5 rounded-[3px] border border-fg/[0.06]" style={{ background: LEVEL_BG[x.l] }} />
                  <span className="font-mono">{x.text}</span>
                </li>
              ))}
            </ul>
            <span>Dimmed cells fall outside the selected range ({labelDay(grid.to)} is the last day).</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
