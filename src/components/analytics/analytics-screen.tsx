"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Info, Route } from "lucide-react";
import { Alert, Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { Toaster, useToasts } from "@/components/ui/toaster";
import { formatNumber } from "@/lib/format";
import { buildDataset } from "@/lib/analytics/dataset";
import { DEFINITIONS } from "@/lib/analytics/definitions";
import { buildCsv, buildReport, downloadText } from "@/lib/analytics/export";
import { formatKm, formatMass, pct } from "@/lib/analytics/format";
import { MODES, type ModeId } from "@/lib/analytics/modes";
import {
  activityPattern,
  cleanShare,
  emissionSeries,
  filterJourneys,
  filterRewards,
  hasComparison,
  heatGrid,
  modeBreakdown,
  originOf,
  pctChange,
  prevRange,
  rangeDays,
  rewardSeries,
  rewardTotals,
  sparkSeries,
  totalsOf,
  verifiedShare,
  bucketSize,
  type Range,
} from "@/lib/analytics/selectors";
import { addDays, dayStart, isoDay, labelClock, labelDay, parseIsoDay } from "@/lib/analytics/time";
import type { Filters, RewardFact, Scope } from "@/lib/analytics/types";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useRewards } from "@/providers/rewards-provider";
import { useTrip } from "@/providers/trip-provider";
import { ActivityHeatmap } from "./activity-heatmap";
import { C, Skeleton, type SourceKind } from "./chart-kit";
import { DashboardControls, type Preset } from "./dashboard-controls";
import { DataSources } from "./data-sources";
import { EmissionsChart } from "./emissions-chart";
import { EsgInsights } from "./esg-insights";
import { JourneyTable } from "./journey-table";
import { KPI_ICONS, KpiGrid, type KpiCardData, type Trend } from "./kpi-grid";
import { Leaderboard } from "./leaderboard";
import { ModeDonut } from "./mode-donut";
import { RewardChart } from "./reward-chart";

/** Client-only "now": 0 during prerender/hydration (so the page renders its loading state), then fixed for the session. */
let bootMs = 0;
const getBoot = () => (bootMs ||= Date.now());
const noopSubscribe = () => () => {};
const useBootTime = () => useSyncExternalStore(noopSubscribe, getBoot, () => 0);

const FALLBACK_DAYS = 30;

function rewardSource(rs: RewardFact[]): { kind: SourceKind; label?: string } {
  const o = new Set(rs.map((r) => r.origin));
  if (o.size === 0) return { kind: "none" };
  const parts = [o.has("demo") && "Demo", o.has("session") && "Session", o.has("onchain") && "On-chain"].filter(Boolean) as string[];
  if (o.size === 1) return { kind: o.has("onchain") ? "onchain" : o.has("session") ? "session" : "demo" };
  return { kind: o.has("demo") ? "mixed" : "session", label: parts.join(" + ") };
}

export function AnalyticsScreen() {
  const boot = useBootTime();
  const { registration } = useOnboarding();
  const { history } = useTrip();
  const { summary, redemptions, onchainActive, chainEvents, onchain, refreshOnchain } = useRewards();
  const { toasts, push, dismiss } = useToasts();

  const [preset, setPreset] = useState<Preset>(30);
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [mode, setMode] = useState<ModeId | "all">("all");
  const [scope, setScope] = useState<Scope>("community");
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const asOf = refreshedAt ?? boot;
  const ready = asOf > 0;
  const today = ready ? dayStart(asOf) : 0;
  const chainAt = onchain?.at ?? null;
  const registeredAt = registration?.registeredAt ?? null;

  const ds = useMemo(
    () =>
      ready
        ? buildDataset({ today, trips: history, rewardEvents: summary.events, redemptions, chainEvents: onchainActive ? chainEvents : null, chainAt, registeredAt })
        : null,
    // refreshedAt forces a recompute on "Refresh" even though every input is already reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, today, history, summary.events, redemptions, onchainActive, chainEvents, chainAt, registeredAt, refreshedAt],
  );

  /* ---- range ---- */
  let range: Range = { start: 0, end: 0 };
  let customError: string | null = null;
  if (ds) {
    if (preset === "custom") {
      const f = parseIsoDay(custom.from);
      const t = parseIsoDay(custom.to);
      if (f === null || t === null) customError = "Enter a valid start and end date.";
      else if (f > t) customError = "The start date must be on or before the end date.";
      else if (t > ds.today) customError = "The end date cannot be in the future.";
      else if (f < ds.coverageStart) customError = `Data is only available from ${isoDay(ds.coverageStart)}.`;
      range = customError ? { start: addDays(ds.today, -(FALLBACK_DAYS - 1)), end: ds.today } : { start: f!, end: t! };
    } else {
      range = { start: addDays(ds.today, -(preset - 1)), end: ds.today };
    }
  }
  const filters: Filters = { start: range.start, end: range.end, scope, mode };
  const days = ds ? rangeDays(range) : 0;

  /* ---- derived data (all from the shared selectors) ---- */
  const view = useMemo(() => {
    if (!ds) return null;
    const journeys = filterJourneys(ds, filters, range);
    const journeysAllModes = filterJourneys(ds, filters, range, { ignoreMode: true });
    const rewards = filterRewards(ds, filters, range);
    const cur = totalsOf(journeys);
    const curR = rewardTotals(rewards);
    const pr = prevRange(range);
    const prevOk = pr.start >= ds.coverageStart;
    const prev = prevOk ? totalsOf(filterJourneys(ds, filters, pr)) : null;
    const prevR = prevOk ? rewardTotals(filterRewards(ds, filters, pr)) : null;
    const comparable = !!prev && !!prevR && hasComparison(ds, range, prev, prevR);
    const heat = heatGrid(filterJourneys(ds, filters, { start: ds.coverageStart, end: ds.today }), range, ds.today);
    return {
      journeys,
      rewards,
      cur,
      curR,
      prev,
      prevR,
      comparable,
      modes: modeBreakdown(journeysAllModes),
      modeSource: originOf(journeysAllModes),
      emission: emissionSeries(journeys, range),
      rewardPts: rewardSeries(rewards, range),
      spark: sparkSeries(journeys, rewards, range),
      pattern: activityPattern(journeys),
      heat,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, range.start, range.end, scope, mode]);

  const aliasOf = useMemo(() => {
    const m = new Map(ds?.commuters.map((c) => [c.key, c.alias]));
    return (k: string) => m.get(k) ?? "Commuter";
  }, [ds]);

  const modeText = mode === "all" ? "All modes" : MODES[mode].label;
  const scopeText = scope === "me" ? "My trips (this browser)" : ds?.has.session && ds.counts.sessionTrips > 0 ? `Community (demo + your ${ds.counts.sessionTrips} trip${ds.counts.sessionTrips === 1 ? "" : "s"})` : "Community (demo dataset)";
  const rangeText = ds ? `${labelDay(range.start)} – ${labelDay(range.end)}` : "";
  const scopeNote = `${scopeText} · ${rangeText} · ${modeText}`;
  const bucketNote = ds ? (bucketSize(days) === 1 ? "daily buckets" : `${bucketSize(days)}-day buckets`) : "";

  /* ---- actions ---- */
  const resetFilters = () => {
    setMode("all");
    setPreset(30);
  };
  const choosePreset = (p: Preset) => {
    if (p === "custom" && ds) setCustom({ from: isoDay(range.start), to: isoDay(range.end) });
    setPreset(p);
  };
  const stamp = (name: string, ext: string) => `missionev-${name}-${isoDay(range.start)}_${isoDay(range.end)}-${scope}${mode === "all" ? "" : `-${mode}`}.${ext}`;
  const nothing = !view || (view.journeys.length === 0 && view.rewards.length === 0);

  const exportCsv = () => {
    if (!ds || !view) return;
    const { csv, rows } = buildCsv({ ds, filters, range, generatedAt: Date.now() });
    if (rows === 0) {
      push({ tone: "info", title: "Nothing to export", text: "No rows match the current filters." });
      return;
    }
    downloadText(stamp("analytics", "csv"), csv, "text/csv");
    push({ tone: "ok", title: "CSV downloaded", text: `${formatNumber(rows)} aggregate rows · ${scopeText} · ${rangeText}. Demo data is labelled in the file.` });
  };
  const exportReport = () => {
    if (!ds) return;
    downloadText(stamp("esg-report-demo", "html"), buildReport({ ds, filters, range, generatedAt: Date.now() }), "text/html");
    push({ tone: "ok", title: "Demo ESG report downloaded", text: "Aggregate figures only. Not sent to any city authority or reporting system." });
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      if (onchainActive) await refreshOnchain();
      await new Promise((r) => setTimeout(r, 350));
      const now = Date.now();
      setRefreshedAt(now);
      push({ tone: "ok", title: "Dashboard refreshed", text: `Recomputed from the current sources at ${labelClock(now)}.${onchainActive ? " Contract events re-read through your wallet." : " The demo community is deterministic, so its values do not change."}` });
    } finally {
      setRefreshing(false);
    }
  };

  /* ---- KPI cards ---- */
  const cards: KpiCardData[] = useMemo(() => {
    if (!view || !ds) return [];
    const { cur, curR, prev, prevR, comparable, journeys, rewards, spark } = view;
    const jSrc = originOf(journeys);
    const simOnly = journeys.some((j) => j.origin === "session") && journeys.filter((j) => j.origin === "session").every((j) => j.simulated);
    const jKind: SourceKind = jSrc;
    const jLabel = jSrc === "session" && simOnly ? "Session · simulated" : undefined;
    const t = (v: number | null, unit: Trend["unit"], goodUp: boolean | null): Trend => ({ value: comparable ? v : null, unit, goodUp });
    const cs = cleanShare(cur);
    const pcs = prev ? cleanShare(prev) : null;
    const mass = formatMass(cur.avoidedG);
    const rs = rewardSource(rewards);
    return [
      { id: "co2", label: "Total estimated CO₂ saved", value: mass.value, unit: mass.unit, icon: KPI_ICONS.co2, source: jKind, sourceLabel: jLabel, color: C.lime, trend: t(pctChange(cur.avoidedG, prev?.avoidedG), "%", true), sub: "Estimated avoided emissions (Journey Lab rule). Not a certified credit.", spark: spark.avoided },
      { id: "trips", label: "Verified trips", value: formatNumber(cur.verified), icon: KPI_ICONS.trips, source: jKind, sourceLabel: jLabel, color: C.cyan, trend: t(pctChange(cur.verified, prev?.verified), "%", true), sub: `${formatNumber(cur.journeys)} recorded journeys · ${pct(verifiedShare(cur))} verified`, spark: spark.verified },
      { id: "distance", label: "Total mobility distance", value: formatKm(cur.distanceKm), unit: "km", icon: KPI_ICONS.distance, source: jKind, sourceLabel: jLabel, color: C.cyan, trend: t(pctChange(cur.distanceKm, prev?.distanceKm), "%", null), sub: "Distance of verified journeys", spark: spark.distance },
      { id: "commuters", label: "Active commuters", value: formatNumber(cur.commuters), icon: KPI_ICONS.users, source: jKind, sourceLabel: jLabel, color: C.lime, trend: t(pctChange(cur.commuters, prev?.commuters), "%", true), sub: scope === "community" ? `Unique with ≥1 verified journey, of ${ds.counts.demoCommuters + 1} profiles (demo + you)` : "Your registered commuter", spark: spark.commuters },
      { id: "clean", label: "Clean mobility share", value: cs === null ? "—" : pct(cs), icon: KPI_ICONS.clean, source: jKind, sourceLabel: jLabel, color: "var(--mode-active)", trend: t(cs !== null && pcs !== null ? (cs - pcs) * 100 : null, "pp", true), sub: "EV, metro, e-bus and walking/cycling ÷ verified journeys", progress: cs },
      { id: "rewards", label: "MissionEV rewards distributed", value: formatNumber(curR.earned), unit: "$MEV", icon: KPI_ICONS.rewards, source: rs.kind, sourceLabel: rs.label, color: C.lime, trend: t(pctChange(curR.earned, prevR?.earned), "%", true), sub: `${formatNumber(curR.pending)} pending · ${formatNumber(curR.redeemed)} redeemed · tPOT gas excluded`, spark: spark.rewards },
    ];
  }, [view, ds, scope]);

  /* ---- render ---- */
  const hasYou = !!ds && ds.counts.sessionTrips > 0;
  const meEmpty = ready && scope === "me" && !hasYou;
  const loading = !ready;

  return (
    <div className="space-y-8">
      <section aria-labelledby="analytics-title" className="space-y-4">
        <p className="font-mono text-[11px] tracking-[0.2em] text-lime sm:text-xs">04 / ESG INTELLIGENCE</p>
        <h1 id="analytics-title" className="max-w-3xl text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Mobility data. Collective impact.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
          Understand individual progress and aggregate mobility patterns through transparent emissions estimates and verifiable reward activity.
        </p>
        <div className="flex flex-wrap items-center gap-2" data-testid="status-badges">
          <Badge tone="warn" dot>
            Analytics overview / demo data
          </Badge>
          {onchainActive && (
            <Badge tone="ok" dot>
              + On-chain wallet events
            </Badge>
          )}
          {ready && <span className="font-mono text-[11px] text-muted">Data as of {labelClock(asOf)}</span>}
        </div>
      </section>

      {ready ? (
        <DashboardControls
          preset={preset}
          onPreset={choosePreset}
          custom={custom}
          onCustom={setCustom}
          customError={customError}
          minIso={isoDay(ds!.coverageStart)}
          maxIso={isoDay(ds!.today)}
          mode={mode}
          onMode={setMode}
          scope={scope}
          onScope={setScope}
          onCsv={exportCsv}
          csvDisabled={nothing}
          onRefresh={refresh}
          refreshing={refreshing}
          summary={`Showing ${rangeText} (${days} day${days === 1 ? "" : "s"}) · ${scopeText} · ${modeText} · ${formatNumber(view?.cur.verified ?? 0)} verified journeys${customError ? ` · ${customError} Showing the last ${FALLBACK_DAYS} days instead.` : ""}`}
        />
      ) : (
        <div role="status" className="space-y-3">
          <p className="font-mono text-xs tracking-[0.1em] text-muted uppercase">Loading analytics…</p>
          <p className="late-hint max-w-xl text-xs leading-relaxed text-warn">
            Still loading? This screen needs the page&apos;s scripts to run. If you opened the development server at an address other than localhost, open it via localhost instead, or restart the server.
          </p>
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      {ready && onchainActive && (
        <Alert tone="cyan" icon={<Info aria-hidden className="size-4" />} title="On-chain events are included for your wallet only">
          Reward figures for “You” come from real contract events. Emissions metrics still derive from the trips recorded in this browser (D2), and the rest of the community stays demo data because no event indexer is configured.
        </Alert>
      )}

      {meEmpty ? (
        <Panel className="p-6 sm:p-10" data-testid="me-empty">
          <div role="status" className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
            <Route aria-hidden className="size-9 text-muted" />
            <p className="text-lg font-medium text-fg">No trips from this browser yet</p>
            <p className="text-sm leading-relaxed text-muted">“My trips” shows only journeys recorded in this tab (D2). Capture and verify a trip on Screen 02, or switch to the community view to explore the demo dataset.</p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Link href="/capture-trip" className="inline-flex h-10 items-center rounded-lg bg-lime px-4 font-mono text-xs tracking-[0.1em] text-bg uppercase hover:shadow-glow-lime">
                Capture a trip
              </Link>
              <Button onClick={() => setScope("community")}>View community (demo)</Button>
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <KpiGrid cards={cards.length ? cards : PLACEHOLDER_CARDS} compare={`vs previous ${days} days`} loading={loading || refreshing} />

          {view && ds ? (
            <div className={refreshing ? "pointer-events-none space-y-8 opacity-60 transition-opacity" : "space-y-8 transition-opacity"} aria-busy={refreshing || undefined}>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <EmissionsChart data={view.emission} source={originOf(view.journeys)} scopeNote={scopeNote} bucketNote={bucketNote} onReset={resetFilters} />
                <ModeDonut slices={view.modes.slices} total={view.modes.total} selected={mode} onSelect={setMode} source={view.modeSource} scopeNote={`${scopeText} · ${rangeText}`} />
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <RewardChart data={view.rewardPts} source={rewardSource(view.rewards).kind} sourceLabel={rewardSource(view.rewards).label} scopeNote={scopeNote} modeFiltered={mode !== "all"} onReset={resetFilters} />
                <ActivityHeatmap grid={view.heat} source={originOf(view.journeys)} scopeNote={scopeNote} onReset={resetFilters} />
              </div>

              <JourneyTable journeys={view.journeys} aliasOf={aliasOf} modeLabel={`${scopeText} · ${rangeText} · ${modeText}`} onReset={resetFilters} />
              <Leaderboard ds={ds} range={range} />
              <EsgInsights
                cur={view.cur}
                prev={view.prev}
                curR={view.curR}
                prevR={view.prevR}
                comparable={view.comparable}
                days={days}
                slices={view.modes.slices}
                total={view.modes.total}
                pattern={view.pattern}
                scopeNote={scopeNote}
                onReport={exportReport}
                onCsv={exportCsv}
                csvDisabled={nothing}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-busy="true" aria-label="Loading charts">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-72 w-full" />
              ))}
            </div>
          )}
        </>
      )}

      {ds && <DataSources ds={ds} refreshedAt={asOf} />}

      <Panel aria-labelledby="defs-title">
        <PanelHeader id="defs-title" eyebrow="Calculation consistency" title="Metric definitions" subtitle="Shared by every screen and by the exports." />
        <details className="group p-4 sm:p-6">
          <summary className="cursor-pointer text-sm font-medium text-cyan marker:text-muted">Show definitions and limits</summary>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            {DEFINITIONS.map((d) => (
              <div key={d.term}>
                <dt className="section-label">{d.term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{d.text}</dd>
              </div>
            ))}
          </dl>
        </details>
      </Panel>

      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

const PLACEHOLDER_CARDS: KpiCardData[] = ["co2", "trips", "distance", "commuters", "clean", "rewards"].map((id) => ({
  id,
  label: id,
  value: "—",
  icon: null,
  source: "none",
  color: C.cyan,
  trend: { value: null, unit: "%", goodUp: true },
  sub: "",
}));
