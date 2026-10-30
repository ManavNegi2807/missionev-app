"use client";

import { FileText, Download } from "lucide-react";
import { Alert, Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/format";
import { formatKm, massText, pct, signed } from "@/lib/analytics/format";
import { MODE_LIST } from "@/lib/analytics/modes";
import { pctChange, type ActivityPattern, type ModeSlice, type RewardTotals, type Totals } from "@/lib/analytics/selectors";
import { cleanShare, verifiedShare } from "@/lib/analytics/selectors";

interface Props {
  cur: Totals;
  prev: Totals | null;
  curR: RewardTotals;
  prevR: RewardTotals | null;
  comparable: boolean;
  days: number;
  slices: ModeSlice[];
  total: number;
  pattern: ActivityPattern;
  scopeNote: string;
  onReport: () => void;
  onCsv: () => void;
  csvDisabled: boolean;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-bg-2/60 p-3.5">
      <p className="section-label">{label}</p>
      <p className="mt-1.5 font-mono text-xl leading-tight font-semibold text-fg [overflow-wrap:anywhere]">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function EsgInsights(p: Props) {
  const { cur, prev, curR, prevR, comparable } = p;
  const deltaCell = (c: number, pv: number | null | undefined, goodUp: boolean | null) => {
    const d = comparable ? pctChange(c, pv) : null;
    if (d === null) return <span className="text-muted">No comparison data</span>;
    const good = goodUp === null ? null : goodUp ? d >= 0 : d <= 0;
    return <span className={cn("font-mono", good === null ? "text-cyan" : good ? "text-ok" : "text-err")}>{signed(d)}%</span>;
  };
  const cs = cleanShare(cur);
  const pcs = prev ? cleanShare(prev) : null;
  const csDelta = comparable && cs !== null && pcs !== null ? (cs - pcs) * 100 : null;

  const rows: Array<{ k: string; cur: string; prev: string; d: React.ReactNode }> = [
    { k: "Verified journeys", cur: formatNumber(cur.verified), prev: comparable && prev ? formatNumber(prev.verified) : "—", d: deltaCell(cur.verified, prev?.verified, true) },
    { k: "Estimated transport emissions", cur: massText(cur.actualG), prev: comparable && prev ? massText(prev.actualG) : "—", d: deltaCell(cur.actualG, prev?.actualG, false) },
    { k: "Estimated avoided emissions", cur: massText(cur.avoidedG), prev: comparable && prev ? massText(prev.avoidedG) : "—", d: deltaCell(cur.avoidedG, prev?.avoidedG, true) },
    {
      k: "Clean mobility share",
      cur: pct(cs),
      prev: comparable ? pct(pcs) : "—",
      d: csDelta === null ? <span className="text-muted">No comparison data</span> : <span className={cn("font-mono", csDelta >= 0 ? "text-ok" : "text-err")}>{signed(csDelta)} pts</span>,
    },
    { k: "$MEV earned", cur: formatNumber(curR.earned), prev: comparable && prevR ? formatNumber(prevR.earned) : "—", d: deltaCell(curR.earned, prevR?.earned, true) },
    { k: "$MEV redeemed", cur: formatNumber(curR.redeemed), prev: comparable && prevR ? formatNumber(prevR.redeemed) : "—", d: deltaCell(curR.redeemed, prevR?.redeemed, null) },
  ];

  const maxDay = Math.max(...p.pattern.byWeekday, 1);

  return (
    <Panel aria-labelledby="esg-title" data-section="esg">
      <PanelHeader
        id="esg-title"
        eyebrow="Process 7.0 → Companies & city planners"
        title="Urban mobility / ESG insights"
        subtitle={`${p.scopeNote}. Aggregate figures only — no trip coordinates or vehicle identifiers.`}
        action={<Badge tone="warn" dot>Demo report</Badge>}
      />
      <div className="space-y-6 p-4 sm:p-6">
        {cur.verified === 0 ? (
          <Alert tone="neutral" title="No verified journeys in this view">
            The summary below needs verified journeys. Widen the range or change scope / mode.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Aggregate est. transport emissions" value={massText(cur.actualG)} sub={`${formatKm(cur.distanceKm)} km of verified travel`} />
          <Stat label="Aggregate est. avoided emissions" value={massText(cur.avoidedG)} sub={`vs ${massText(cur.baselineG)} petrol-bike baseline`} />
          <Stat label="Verified-trip share" value={pct(verifiedShare(cur))} sub={`${formatNumber(cur.verified)} of ${formatNumber(cur.journeys)} recorded journeys`} />
          <Stat label="Reward activity" value={`${formatNumber(curR.earned)} $MEV`} sub={`${formatNumber(curR.redeemed)} redeemed · ${formatNumber(curR.pending)} pending`} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div>
            <p className="section-label mb-3">Transport-mode distribution</p>
            {p.total === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">No verified journeys to split by mode.</p>
            ) : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-fg/[0.06]" role="img" aria-label={p.slices.map((s) => `${s.label} ${pct(s.share)}`).join(", ")}>
                  {p.slices.map((s) => (s.share > 0 ? <span key={s.mode} style={{ width: `${s.share * 100}%`, background: s.color }} /> : null))}
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {MODE_LIST.map((m) => {
                    const s = p.slices.find((x) => x.mode === m.id)!;
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-muted">
                          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: m.color }} />
                          <span className="truncate">{m.label}</span>
                        </span>
                        <span className="font-mono text-fg">{pct(s.share)}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div>
            <p className="section-label mb-3">Mobility activity pattern (verified journeys by weekday)</p>
            {p.pattern.busiest ? (
              <>
                <div className="flex h-24 items-end gap-2" role="img" aria-label={`Verified journeys by weekday. Busiest: ${p.pattern.busiest.name}.`}>
                  {p.pattern.byWeekday.map((n, i) => (
                    <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                      <div className="rounded-t bg-ok/70" style={{ height: `${(n / maxDay) * 100}%`, minHeight: n > 0 ? 3 : 0 }} title={`${n} journeys`} />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-2 text-[11px] text-muted">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <span key={d} className="min-w-0 flex-1 text-center">
                      {d}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted">
                  Busiest day: <span className="text-fg">{p.pattern.busiest.name}</span> ({pct(p.pattern.busiest.share)} of verified journeys). Weekend share <span className="text-fg">{pct(p.pattern.weekendShare)}</span>.
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">Not enough verified journeys for an activity pattern.</p>
            )}
          </div>
        </div>

        <div>
          <p className="section-label mb-3">Time-period comparison · vs the previous {p.days} days</p>
          {!comparable && (
            <p className="mb-3 text-xs text-muted" data-testid="no-comparison">
              No comparison is shown because the previous period has no data (or lies outside the dataset’s coverage). Trends are never estimated.
            </p>
          )}
          <ul className="space-y-2 sm:hidden" aria-label="Period comparison">
            {rows.map((r) => (
              <li key={r.k} className="rounded-lg border border-line p-3">
                <p className="text-sm text-fg">{r.k}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div className="min-w-0">
                    <dt className="section-label">This period</dt>
                    <dd className="mt-0.5 font-mono text-[13px] text-fg [overflow-wrap:anywhere]">{r.cur}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="section-label">Previous</dt>
                    <dd className="mt-0.5 font-mono text-[13px] text-muted [overflow-wrap:anywhere]">{r.prev}</dd>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <dt className="section-label">Change</dt>
                    <dd className="mt-0.5">{r.d}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-xl border border-line sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Metric", "This period", "Previous", "Change"].map((h, i) => (
                    <th key={h} scope="col" className={cn("section-label px-4 py-2.5 font-semibold", i > 0 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rows.map((r) => (
                  <tr key={r.k}>
                    <th scope="row" className="px-4 py-2.5 font-normal text-muted">
                      {r.k}
                    </th>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">{r.cur}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">{r.prev}</td>
                    <td className="px-4 py-2.5 text-right text-xs">{r.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-2/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Export the current view as a <span className="text-fg">demo ESG report</span> (HTML, printable) or aggregate CSV. Not connected to any city authority, Power BI workspace or enterprise reporting system.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={p.onReport} icon={<FileText aria-hidden className="size-4" />} data-action="report">
              Download ESG report
            </Button>
            <Button onClick={p.onCsv} disabled={p.csvDisabled} icon={<Download aria-hidden className="size-4" />}>
              Download CSV
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
