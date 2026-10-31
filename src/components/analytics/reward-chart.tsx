"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import type { RewardPoint } from "@/lib/analytics/selectors";
import { C, ChartTip, EmptyState, LegendToggles, SourceBadge, TipRow, useReducedMotion, type LegendItem, type SourceKind } from "./chart-kit";

const SERIES: LegendItem[] = [
  { key: "earned", label: "$MEV earned", color: C.lime, hint: "Recorded rewards (on-chain mints, or demo credits)" },
  { key: "pending", label: "Pending reward events", color: C.warn, hint: "Verified journeys whose record has not been written yet" },
  { key: "redeemed", label: "$MEV redeemed", color: C.cyan, hint: "Completed or simulated redemptions (D4)" },
];

function Tip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: RewardPoint }> }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <ChartTip title={p.long}>
      <TipRow color={C.lime} label="Earned" value={`${formatNumber(p.earned)} $MEV`} />
      <TipRow color={C.warn} label="Pending" value={`${formatNumber(p.pending)} $MEV`} />
      <TipRow color={C.cyan} label="Redeemed" value={`${formatNumber(p.redeemed)} $MEV`} />
    </ChartTip>
  );
}

export function RewardChart({
  data,
  source,
  sourceLabel,
  scopeNote,
  modeFiltered,
  onReset,
}: {
  data: RewardPoint[];
  source: SourceKind;
  sourceLabel?: string;
  scopeNote: string;
  modeFiltered: boolean;
  onReset: () => void;
}) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const reduced = useReducedMotion();
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const empty = data.every((d) => d.earned + d.pending + d.redeemed === 0);
  const anim = { isAnimationActive: !reduced, animationDuration: 450 };

  return (
    <Panel aria-labelledby="chart-reward-title" data-chart="rewards">
      <PanelHeader id="chart-reward-title" eyebrow="Chart 3 · Reward economy" title="$MEV rewards earned and redeemed" subtitle={scopeNote} action={<SourceBadge kind={source} label={sourceLabel} />} />
      {empty ? (
        <EmptyState title="No reward activity in this view" text={modeFiltered ? "A transport-mode filter excludes redemptions, demo top-ups and on-chain events because they are not tied to a mode." : "No earned, pending or redeemed $MEV for the selected range and scope."} action={{ label: "Reset filters", onClick: onReset }} />
      ) : (
        <div className="space-y-4 p-4 sm:p-6">
          <LegendToggles items={SERIES} hidden={hidden} onToggle={toggle} label="Reward series (toggle visibility)" />
          <div className="h-[260px] w-full sm:h-[300px]" role="img" aria-label="Bar chart of $MEV earned, pending and redeemed over the selected period.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} barCategoryGap="24%">
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={22} height={44} label={{ value: "Date (local)", position: "insideBottom", offset: 0, fill: C.axis, fontSize: 11 }} />
                <YAxis tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={58} allowDecimals={false} tickFormatter={(v: number) => formatNumber(v)} label={{ value: "$MEV tokens", angle: -90, position: "insideLeft", offset: 12, fill: C.axis, fontSize: 11, style: { textAnchor: "middle" } }} />
                <Tooltip content={Tip} cursor={{ fill: "var(--chart-cursor)" }} />
                <Bar dataKey="earned" name="$MEV earned" stackId="in" fill={C.lime} hide={hidden.has("earned")} radius={[0, 0, 0, 0]} {...anim} />
                <Bar dataKey="pending" name="Pending" stackId="in" fill={C.warn} fillOpacity={0.75} hide={hidden.has("pending")} radius={[3, 3, 0, 0]} {...anim} />
                <Bar dataKey="redeemed" name="$MEV redeemed" fill={C.cyan} hide={hidden.has("redeemed")} radius={[3, 3, 0, 0]} {...anim} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Amounts are $MEV only — native tPOT gas costs are a separate currency and never appear here.
            {modeFiltered ? " With a mode filter on, redemptions, demo top-ups and on-chain events are excluded because they are not tied to a transport mode." : ""}
          </p>
        </div>
      )}
    </Panel>
  );
}
