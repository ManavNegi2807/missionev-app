import { MODES } from "./modes";
import { filterJourneys, filterRewards, modeBreakdown, prevRange, rangeDays, rewardTotals, totalsOf, cleanShare, verifiedShare, activityPattern, type Range } from "./selectors";
import { DEFINITIONS } from "./definitions";
import { massText, formatKm, pct, signed } from "./format";
import { formatNumber } from "@/lib/format";
import { isoDay, labelClock, labelDay } from "./time";
import type { AnalyticsDataset, Filters } from "./types";

export interface ExportContext {
  ds: AnalyticsDataset;
  filters: Filters;
  range: Range;
  generatedAt: number;
}

/** Neutralise spreadsheet formula injection for any text cell. */
const cell = (v: string | number): string => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const scopeLabel = (f: Filters) => (f.scope === "me" ? "my trips (this browser)" : "community (demo dataset + this browser's trips)");
const modeLabel = (f: Filters) => (f.mode === "all" ? "all modes" : MODES[f.mode].label);

function sourceNote(ds: AnalyticsDataset, f: Filters): string {
  const parts = [] as string[];
  if (f.scope === "community") parts.push("DEMO community data (synthetic, not measured)");
  if (ds.has.session) parts.push("trips recorded in this browser session (mock verification)");
  if (ds.has.onchain) parts.push("on-chain reward events for the connected wallet");
  return parts.join(" + ");
}

/**
 * Aggregate daily-by-mode rows. No coordinates, no vehicle registration numbers and no per-person
 * identifiers — only counts and sums.
 */
export function buildCsv({ ds, filters, range, generatedAt }: ExportContext): { csv: string; rows: number } {
  const js = filterJourneys(ds, filters, range);
  const rs = filterRewards(ds, filters, range);
  type Agg = { journeys: number; verified: number; km: number; base: number; act: number; avoid: number; earned: number; pending: number; redeemed: number; demo: boolean; session: boolean };
  const key = (day: number, mode: string) => `${day}|${mode}`;
  const map = new Map<string, { day: number; mode: string; a: Agg }>();
  const get = (day: number, mode: string) => {
    const k = key(day, mode);
    let e = map.get(k);
    if (!e) map.set(k, (e = { day, mode, a: { journeys: 0, verified: 0, km: 0, base: 0, act: 0, avoid: 0, earned: 0, pending: 0, redeemed: 0, demo: false, session: false } }));
    return e.a;
  };
  for (const j of js) {
    const a = get(j.day, MODES[j.mode].label);
    a.journeys++;
    if (j.origin === "demo") a.demo = true;
    else a.session = true;
    if (!j.verified) continue;
    a.verified++;
    a.km += j.distanceKm;
    a.base += j.baselineG;
    a.act += j.actualG;
    a.avoid += j.avoidedG;
  }
  for (const r of rs) {
    const a = get(r.day, r.mode ? MODES[r.mode].label : "(not attributable to a mode)");
    a[r.kind] += r.amount;
    if (r.origin === "demo") a.demo = true;
    else a.session = true;
  }
  const rows = [...map.values()].sort((x, y) => x.day - y.day || x.mode.localeCompare(y.mode));
  const head = [
    "date", "transport_mode", "journeys_total", "journeys_verified", "distance_km", "baseline_co2e_g", "estimated_co2e_g", "avoided_co2e_g", "mev_earned", "mev_pending", "mev_redeemed", "data_origin",
  ];
  const lines = [
    `# MissionEV analytics export - ${sourceNote(ds, filters) || "no data"}`,
    `# Range ${isoDay(range.start)} to ${isoDay(range.end)} | scope: ${scopeLabel(filters)} | mode filter: ${modeLabel(filters)} | generated ${isoDay(generatedAt)} ${labelClock(generatedAt)}`,
    "# Estimates only - not certified carbon credits. Verified journeys only for distance/CO2e. tPOT gas excluded. Aggregate rows: no coordinates or vehicle identifiers.",
    head.join(","),
    ...rows.map(({ day, mode, a }) =>
      [isoDay(day), mode, a.journeys, a.verified, a.km.toFixed(1), a.base.toFixed(0), a.act.toFixed(0), a.avoid, a.earned, a.pending, a.redeemed, a.demo && a.session ? "demo+session" : a.session ? "session" : "demo"]
        .map((v) => cell(v))
        .join(","),
    ),
  ];
  return { csv: lines.join("\r\n") + "\r\n", rows: rows.length };
}

const esc = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function delta(cur: number, prev: number | null, goodUp = true): string {
  if (prev === null || prev <= 0) return "no comparison data";
  const p = ((cur - prev) / prev) * 100;
  return `${signed(p)}% (${goodUp ? (p >= 0 ? "improving" : "declining") : p >= 0 ? "higher" : "lower"})`;
}

/** Self-contained, print-friendly HTML report (aggregate figures only). */
export function buildReport({ ds, filters, range, generatedAt }: ExportContext): string {
  const cur = totalsOf(filterJourneys(ds, filters, range));
  const curModes = filterJourneys(ds, filters, range);
  const prevR = prevRange(range);
  const prevOk = prevR.start >= ds.coverageStart;
  const prev = prevOk ? totalsOf(filterJourneys(ds, filters, prevR)) : null;
  const rw = rewardTotals(filterRewards(ds, filters, range));
  const prw = prevOk ? rewardTotals(filterRewards(ds, filters, prevR)) : null;
  const dist = modeBreakdown(filterJourneys(ds, { ...filters, mode: "all" }, range));
  const pat = activityPattern(curModes);
  const hasPrev = !!prev && prev.journeys > 0;

  const rowsHtml = (rows: Array<[string, string, string]>) => rows.map(([a, b, c]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("");
  const days = rangeDays(range);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MissionEV ESG report (DEMO)</title>
<style>
body{font:15px/1.55 system-ui,Segoe UI,Roboto,sans-serif;color:#14202b;max-width:860px;margin:2rem auto;padding:0 1rem}
h1{font-size:1.6rem;margin:.2rem 0}h2{font-size:1.05rem;margin:2rem 0 .5rem;border-bottom:1px solid #cbd5df;padding-bottom:.3rem}
.banner{background:#fff4d6;border:1px solid #e3b341;border-radius:8px;padding:.7rem 1rem;font-weight:600}
table{border-collapse:collapse;width:100%;margin:.5rem 0}th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid #e1e7ed;vertical-align:top}
th{font-weight:600;width:42%}.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.6rem}.k div{border:1px solid #cbd5df;border-radius:8px;padding:.6rem .8rem}
.k b{display:block;font-size:1.3rem}small,.muted{color:#5a6b7b}ul{padding-left:1.2rem}
</style></head><body>
<p class="muted">MissionEV · ESG &amp; mobility analytics · generated ${esc(isoDay(generatedAt))} ${esc(labelClock(generatedAt))}</p>
<h1>Urban mobility / ESG summary</h1>
<p class="banner">DEMO REPORT — ${esc(sourceNote(ds, filters) || "no data")}. Figures are estimates, not certified carbon credits, and are not connected to any city authority or enterprise reporting system.</p>
<p>Period: <b>${esc(isoDay(range.start))} to ${esc(isoDay(range.end))}</b> (${days} days) · Scope: ${esc(scopeLabel(filters))} · Mode filter: ${esc(modeLabel(filters))}</p>

<h2>Headline figures</h2>
<div class="k">
<div><small>Estimated avoided emissions</small><b>${esc(massText(cur.avoidedG))}</b></div>
<div><small>Estimated transport emissions</small><b>${esc(massText(cur.actualG))}</b></div>
<div><small>Verified journeys</small><b>${esc(formatNumber(cur.verified))}</b></div>
<div><small>Distance (verified)</small><b>${esc(formatKm(cur.distanceKm))} km</b></div>
<div><small>Clean mobility share</small><b>${esc(pct(cleanShare(cur)))}</b></div>
<div><small>$MEV earned / redeemed</small><b>${esc(formatNumber(rw.earned))} / ${esc(formatNumber(rw.redeemed))}</b></div>
</div>

<h2>Transport-mode distribution (verified journeys)</h2>
<table><tr><th>Mode</th><td><b>Journeys (share)</b></td><td><b>Distance · est. emissions</b></td></tr>
${rowsHtml(dist.slices.map((s) => [s.label, `${formatNumber(s.trips)} (${pct(s.share)})`, `${formatKm(s.distanceKm)} km · ${massText(s.actualG)}`]))}</table>

<h2>Activity pattern</h2>
<ul><li>Verified-trip share: ${esc(pct(verifiedShare(cur)))} of ${esc(formatNumber(cur.journeys))} recorded journeys.</li>
<li>Busiest weekday: ${esc(pat.busiest ? `${pat.busiest.name} (${pct(pat.busiest.share)} of verified journeys)` : "not enough data")}.</li>
<li>Weekend share: ${esc(pct(pat.weekendShare))}.</li></ul>

<h2>Comparison with the previous ${days} days</h2>
<table><tr><th>Metric</th><td><b>This period</b></td><td><b>Change</b></td></tr>
${rowsHtml([
    ["Verified journeys", formatNumber(cur.verified), hasPrev ? delta(cur.verified, prev!.verified) : "no comparison data"],
    ["Avoided emissions", massText(cur.avoidedG), hasPrev ? delta(cur.avoidedG, prev!.avoidedG) : "no comparison data"],
    ["Estimated transport emissions", massText(cur.actualG), hasPrev ? delta(cur.actualG, prev!.actualG, false) : "no comparison data"],
    ["$MEV earned", formatNumber(rw.earned), prw && prw.earned > 0 ? delta(rw.earned, prw.earned) : "no comparison data"],
  ])}</table>

<h2>Method and limits</h2>
<ul>${DEFINITIONS.map((d) => `<li><b>${esc(d.term)}.</b> ${esc(d.text)}</li>`).join("")}</ul>
<p class="muted">Community figures come from a synthetic demo dataset. Aggregate counts only: no trip coordinates, vehicle registration numbers or wallet addresses are included. Day range ${esc(labelDay(range.start))} – ${esc(labelDay(range.end))}.</p>
</body></html>`;
}

export function downloadText(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
