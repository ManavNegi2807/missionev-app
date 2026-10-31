"use client";

import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import type { EmissionPoint } from "@/lib/analytics/selectors";
import { C, ChartTip, EmptyState, LegendToggles, SourceBadge, TipRow, useReducedMotion, type LegendItem, type SourceKind } from "./chart-kit";

const SERIES: LegendItem[] = [
  { key: "baselineKg", label: "Estimated baseline", color: C.muted, dashed: true, hint: "Same distance on the reference petrol vehicle (a MissionEV assumption)" },
  { key: "actualKg", label: "Estimated actual", color: C.cyan, hint: "Tailpipe + electricity-generation emissions of the modes used" },
  { key: "avoidedKg", label: "Estimated avoided", color: C.lime, hint: "Only journeys below the reference count" },
];

const kgText = (n: number) => `${formatNumber(n, n < 10 ? 3 : 1)} kg CO₂e`;

function Tip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: EmissionPoint }> }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <ChartTip title={p.long}>
      <TipRow color={C.muted} dashed label="Baseline (est.)" value={kgText(p.baselineKg)} />
      <TipRow color={C.cyan} label="Actual (est.)" value={kgText(p.actualKg)} />
      <TipRow color={C.lime} label="Avoided (est.)" value={kgText(p.avoidedKg)} />
      <p className="border-t border-line pt-1.5 text-[11px] text-muted">{formatNumber(p.journeys)} verified journeys · estimate, not a certified credit</p>
    </ChartTip>
  );
}

export function EmissionsChart({ data, source, scopeNote, bucketNote, onReset }: { data: EmissionPoint[]; source: SourceKind; scopeNote: string; bucketNote: string; onReset: () => void }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const reduced = useReducedMotion();
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const empty = data.every((d) => d.journeys === 0);
  const anim = { isAnimationActive: !reduced, animationDuration: 450 };

  return (
    <Panel aria-labelledby="chart-emissions-title" data-chart="emissions">
      <PanelHeader id="chart-emissions-title" eyebrow="Chart 1 · CO₂e over time" title="Estimated emissions reduction" subtitle={`${scopeNote} · ${bucketNote}`} action={<SourceBadge kind={source} />} />
      {empty ? (
        <EmptyState title="No verified journeys in this view" text="Widen the date range, switch scope or mode, or record and verify a trip on Screen 02." action={{ label: "Reset filters", onClick: onReset }} />
      ) : (
        <div className="space-y-4 p-4 sm:p-6">
          <LegendToggles items={SERIES} hidden={hidden} onToggle={toggle} label="Emission series (toggle visibility)" />
          <div className="h-[280px] w-full sm:h-[340px] xl:h-[470px]" role="img" aria-label={`Line and area chart of estimated baseline, actual and avoided emissions in kilograms CO₂e. ${data.length} points.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="gAvoided" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.lime} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={C.lime} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={22} height={44} label={{ value: "Date (local)", position: "insideBottom", offset: 0, fill: C.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={58} tickFormatter={(v: number) => formatNumber(v, v < 10 && v !== 0 ? 1 : 0)} label={{ value: "kg CO₂e (estimated)", angle: -90, position: "insideLeft", offset: 12, fill: C.axis, fontSize: 11, style: { textAnchor: "middle" } }} />
                <Tooltip content={Tip} cursor={{ stroke: C.axis, strokeDasharray: "3 3" }} />
                <Area type="monotone" dataKey="avoidedKg" name="Estimated avoided" stroke={C.lime} strokeWidth={2} fill="url(#gAvoided)" hide={hidden.has("avoidedKg")} dot={false} activeDot={{ r: 4 }} {...anim} />
                <Line type="monotone" dataKey="baselineKg" name="Estimated baseline" stroke={C.muted} strokeWidth={1.75} strokeDasharray="5 4" hide={hidden.has("baselineKg")} dot={false} activeDot={{ r: 4 }} {...anim} />
                <Line type="monotone" dataKey="actualKg" name="Estimated actual" stroke={C.cyan} strokeWidth={2} hide={hidden.has("actualKg")} dot={false} activeDot={{ r: 4 }} {...anim} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Avoided emissions count only journeys below their reference journey, floored to whole grams, so baseline minus actual can be larger or smaller than the avoided line. All values are estimates; nothing here is a certified carbon-credit issuance.
          </p>
        </div>
      )}
    </Panel>
  );
}
