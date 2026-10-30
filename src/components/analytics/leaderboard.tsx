"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Search, Trophy } from "lucide-react";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/format";
import { MIN_RANKED_JOURNEYS } from "@/lib/analytics/demo-data";
import { formatKm, massText, pct } from "@/lib/analytics/format";
import { MODE_LIST } from "@/lib/analytics/modes";
import { leaderboard, rangeDays, type LeaderRow, type Range } from "@/lib/analytics/selectors";
import { addDays, labelDay } from "@/lib/analytics/time";
import type { AnalyticsDataset } from "@/lib/analytics/types";

type Period = "dashboard" | 7 | 30 | 90;
const PAGE = 10;
const sel = "h-10 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg hover:border-line-strong focus-visible:border-cyan/60 focus-visible:ring-2 focus-visible:ring-cyan/30 focus-visible:outline-none";

function Details({ r }: { r: LeaderRow }) {
  return (
    <div className="space-y-4 px-4 py-4 sm:px-6" data-leader-details={r.key}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {[
          ["Distance (verified)", `${formatKm(r.distanceKm)} km`],
          ["Active days", formatNumber(r.activeDays)],
          ["Last active", labelDay(r.lastActive)],
          ["Clean journey share", pct(r.cleanShare)],
          ["Baseline avoided", pct(r.baselineG > 0 ? r.avoidedG / r.baselineG : 0)],
          ["Clean streak", `${r.streak} ${r.streak === 1 ? "day" : "days"}`],
          ["Profile", r.isDemo ? `${r.archetype} (synthetic)` : r.archetype],
          ["Rank", r.rank ? `#${r.rank}` : `Unranked (<${MIN_RANKED_JOURNEYS} verified)`],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="section-label">{k}</dt>
            <dd className="mt-1 truncate text-sm text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="section-label mb-2">Mode share of verified journeys</p>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-fg/[0.06]" role="img" aria-label={MODE_LIST.map((m) => `${m.label} ${pct(r.modeShare[m.id], 0)}`).join(", ")}>
          {MODE_LIST.map((m) => (r.modeShare[m.id] > 0 ? <span key={m.id} style={{ width: `${r.modeShare[m.id] * 100}%`, background: m.color }} /> : null))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {MODE_LIST.filter((m) => r.modeShare[m.id] > 0).map((m) => (
            <li key={m.id} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: m.color }} />
              {m.label} {pct(r.modeShare[m.id], 0)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Leaderboard({ ds, range }: { ds: AnalyticsDataset; range: Range }) {
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("dashboard");
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const pr: Range = period === "dashboard" ? range : { start: addDays(range.end, -(period - 1)), end: range.end };
  const rows = useMemo(() => leaderboard(ds, pr), [ds, pr.start, pr.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranked = rows.filter((r) => r.rank !== null);
  const me = rows.find((r) => r.isYou);
  const needle = q.trim().toLowerCase();

  const visible = useMemo(() => {
    const matches = (r: LeaderRow) => !needle || r.alias.toLowerCase().includes(needle);
    const list = ranked.filter(matches);
    const shown = all || needle ? list : list.slice(0, PAGE);
    const pinned = me && me.rank === null && matches(me) ? [me] : [];
    // Keep the commuter's own ranked row visible even when it sits below the page cut.
    const extra = me && me.rank !== null && !shown.includes(me) && !needle ? [me] : [];
    return { list, rows: [...pinned, ...shown, ...extra], hidden: Math.max(0, list.length - shown.length) };
  }, [ranked, me, needle, all]);

  const periodText = period === "dashboard" ? `${rangeDays(range)}-day dashboard range` : `last ${period} days`;

  const chip = (r: LeaderRow) => (
    <>
      {r.isYou ? <Badge tone="lime">You</Badge> : <span className="rounded border border-line px-1.5 py-px font-mono text-[10.5px] tracking-wider text-muted uppercase">Demo</span>}
    </>
  );

  return (
    <Panel aria-labelledby="leader-title" data-section="leaderboard">
      <PanelHeader
        id="leader-title"
        eyebrow="Community"
        title="Community mobility leaderboard"
        subtitle={`Ranked on ${periodText}. Demo aliases are synthetic — no real people, wallet addresses or vehicles are shown.`}
        action={<Badge tone="warn" dot>Demo entries</Badge>}
      />

      <div className="grid grid-cols-1 gap-3 border-b border-line px-4 py-4 sm:grid-cols-2 sm:px-6 lg:max-w-2xl">
        <label className="block">
          <span className="section-label mb-1.5 flex items-center gap-1.5">
            <Search aria-hidden className="size-3" /> Search commuter
          </span>
          <input type="search" className={sel} placeholder="Alias, or “you”" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search commuter alias" />
        </label>
        <label className="block">
          <span className="section-label mb-1.5 block">Period</span>
          <select className={sel} value={String(period)} onChange={(e) => setPeriod(e.target.value === "dashboard" ? "dashboard" : (Number(e.target.value) as Period))} aria-label="Leaderboard period">
            <option value="dashboard">Dashboard range</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
      </div>

      {visible.rows.length === 0 ? (
        <div role="status" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <Trophy aria-hidden className="size-8 text-muted" />
          <p className="text-sm font-medium text-fg">{needle ? "No commuter matches this search." : "No ranked commuters in this period."}</p>
          <p className="max-w-sm text-sm text-muted">{needle ? "Check the spelling or clear the search." : `A commuter needs at least ${MIN_RANKED_JOURNEYS} verified journeys in the period to be ranked.`}</p>
          {needle && (
            <Button size="sm" onClick={() => setQ("")}>
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* md+: table */}
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  {["Rank", "Commuter alias", "Est. emissions avoided", "Verified journeys", "Clean streak", "Mobility score", ""].map((h, i) => (
                    <th key={i} scope="col" className={cn("section-label px-4 py-3 font-semibold xl:px-6", i >= 2 && i <= 5 && "text-right")}>
                      {h || <span className="sr-only">Details</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {visible.rows.map((r) => (
                  <Fragment key={r.key}>
                    <tr data-leader-row={r.key} data-you={r.isYou || undefined} className={cn(r.isYou ? "bg-lime/[0.06]" : "hover:bg-fg/[0.02]")}>
                      <td className="px-4 py-3 font-mono text-fg xl:px-6">{r.rank ? `#${r.rank}` : "—"}</td>
                      <td className="px-4 py-3 xl:px-6">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-fg">{r.alias}</span>
                          {chip(r)}
                          {r.rank === null && <span className="text-[11px] text-muted">Unranked</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-fg xl:px-6">{massText(r.avoidedG)}</td>
                      <td className="px-4 py-3 text-right font-mono text-fg xl:px-6">{formatNumber(r.verified)}</td>
                      <td className="px-4 py-3 text-right font-mono text-fg xl:px-6">{r.streak}d</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-lime xl:px-6">{r.score}</td>
                      <td className="px-4 py-3 text-right xl:px-6">
                        <button
                          type="button"
                          aria-expanded={open === r.key}
                          aria-label={`${open === r.key ? "Hide" : "Show"} details for ${r.alias}`}
                          onClick={() => setOpen(open === r.key ? null : r.key)}
                          className="grid size-8 place-items-center rounded-md text-muted hover:bg-fg/[0.06] hover:text-fg"
                        >
                          <ChevronDown aria-hidden className={cn("size-4 transition", open === r.key && "rotate-180")} />
                        </button>
                      </td>
                    </tr>
                    {open === r.key && (
                      <tr className="bg-bg-2/50">
                        <td colSpan={7}>
                          <Details r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* <md: cards */}
          <ul className="divide-y divide-line md:hidden">
            {visible.rows.map((r) => (
              <li key={r.key} data-leader-card={r.key} className={cn(r.isYou && "bg-lime/[0.06]")}>
                <button
                  type="button"
                  aria-expanded={open === r.key}
                  aria-label={`${open === r.key ? "Hide" : "Show"} details for ${r.alias}`}
                  onClick={() => setOpen(open === r.key ? null : r.key)}
                  className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 text-left"
                >
                  <span className="font-mono text-fg">{r.rank ? `#${r.rank}` : "—"}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium text-fg">{r.alias}</span>
                    {chip(r)}
                  </span>
                  <span className="font-mono text-lg font-semibold text-lime">{r.score}</span>
                  <span />
                  <span className="col-span-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                    <span>{massText(r.avoidedG)} avoided</span>
                    <span>{formatNumber(r.verified)} journeys</span>
                    <span>{r.streak}d streak</span>
                  </span>
                </button>
                {open === r.key && (
                  <div className="bg-bg-2/50">
                    <Details r={r} />
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-muted sm:px-6">
            <p>
              {formatNumber(visible.list.length)} ranked commuter{visible.list.length === 1 ? "" : "s"}. Rule: mobility score → avoided emissions → verified journeys; ≥{MIN_RANKED_JOURNEYS} verified journeys to rank.
            </p>
            {visible.hidden > 0 && (
              <Button size="sm" onClick={() => setAll(true)}>
                Show all {formatNumber(ranked.length)}
              </Button>
            )}
            {all && !needle && ranked.length > PAGE && (
              <Button size="sm" variant="ghost" onClick={() => setAll(false)}>
                Show top {PAGE}
              </Button>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
