"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Coins, Leaf, Route, Users, Zap } from "lucide-react";
import { cn } from "@/lib/format";
import { signed } from "@/lib/analytics/format";
import { Skeleton, SourceBadge, type SourceKind } from "./chart-kit";

export interface Trend {
  /** null = nothing to compare against — the card says so instead of inventing a number. */
  value: number | null;
  unit: "%" | "pp";
  /** Is an increase good? null = neutral (e.g. distance). */
  goodUp: boolean | null;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 0);
  if (values.length < 2 || max <= 0) {
    return (
      <svg aria-hidden viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full">
        <line x1="0" y1="26" x2="100" y2="26" stroke="var(--chart-dash)" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 26 - (v / max) * 22] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg aria-hidden viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full">
      <polygon points={`0,28 ${line} 100,28`} fill={color} opacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TrendChip({ trend, compare }: { trend: Trend; compare: string }) {
  if (trend.value === null) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted" data-trend="none">
        <span className="font-mono">—</span> No comparison data
      </p>
    );
  }
  const v = Math.abs(trend.value) < 0.05 ? 0 : trend.value;
  const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
  const good = trend.goodUp === null ? null : trend.goodUp ? v >= 0 : v <= 0;
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : ArrowRight;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted" data-trend={dir}>
      <span className={cn("inline-flex items-center gap-0.5 font-mono font-semibold", good === null || dir === "flat" ? "text-cyan" : good ? "text-ok" : "text-err")}>
        <Icon aria-hidden className="size-3.5" />
        {signed(v, 1)}
        {trend.unit === "pp" ? " pts" : "%"}
      </span>
      {compare}
    </p>
  );
}

export interface KpiCardData {
  id: string;
  label: string;
  value: string;
  unit?: string;
  icon: ReactNode;
  source: SourceKind;
  sourceLabel?: string;
  trend: Trend;
  sub: string;
  spark?: number[];
  /** 0–1 progress bar instead of a sparkline. */
  progress?: number | null;
  color: string;
}

export function KpiGrid({ cards, compare, loading }: { cards: KpiCardData[]; compare: string; loading: boolean }) {
  return (
    <section aria-label="Key metrics" aria-busy={loading || undefined} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) =>
        loading ? (
          <div key={c.id} className="rounded-xl border border-line bg-panel p-4 shadow-panel">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-4 h-8 w-2/3" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-3 h-7 w-full" />
          </div>
        ) : (
          <div key={c.id} data-kpi={c.id} className="flex min-w-0 flex-col rounded-xl border border-line bg-panel p-4 shadow-panel sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-line-strong" style={{ color: c.color }}>
                {c.icon}
              </span>
              <SourceBadge kind={c.source} label={c.sourceLabel} />
            </div>
            <p className="section-label mt-4">{c.label}</p>
            <p className="mt-1.5 font-mono text-[1.75rem] leading-none font-semibold text-fg sm:text-[2rem]" data-kpi-value>
              {c.value}
              {c.unit && <span className="ml-2 text-xs font-normal text-muted">{c.unit}</span>}
            </p>
            <div className="mt-3">
              <TrendChip trend={c.trend} compare={compare} />
            </div>
            <p className="mt-1 text-xs leading-snug text-muted">{c.sub}</p>
            <div className="mt-auto pt-4">
              {c.progress !== undefined ? (
                <div
                  role="img"
                  aria-label={c.progress === null ? "No data" : `${Math.round(c.progress * 100)} percent`}
                  className="h-2 overflow-hidden rounded-full bg-fg/[0.06]"
                >
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(c.progress ?? 0) * 100}%`, background: c.color }} />
                </div>
              ) : (
                <Sparkline values={c.spark ?? []} color={c.color} />
              )}
            </div>
          </div>
        ),
      )}
    </section>
  );
}

export const KPI_ICONS = {
  co2: <Leaf className="size-4" />,
  trips: <BadgeCheck className="size-4" />,
  distance: <Route className="size-4" />,
  users: <Users className="size-4" />,
  clean: <Zap className="size-4" />,
  rewards: <Coins className="size-4" />,
};
