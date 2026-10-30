import { MIN_RANKED_JOURNEYS } from "./demo-data";
import { isClean, MODE_IDS, MODES, type ModeId } from "./modes";
import { addDays, diffDays, labelDay, startOfWeek, weekdayIndex, WEEKDAYS_LONG } from "./time";
import type { AnalyticsDataset, Filters, Journey, RewardFact, Scope } from "./types";

export interface Range {
  start: number;
  end: number;
}

export const rangeDays = (r: Range) => diffDays(r.start, r.end) + 1;
/** The window of equal length immediately before `r`. */
export const prevRange = (r: Range): Range => {
  const len = rangeDays(r);
  const end = addDays(r.start, -1);
  return { start: addDays(end, -(len - 1)), end };
};
const inRange = (d: number, r: Range) => d >= r.start && d <= r.end;
const scopeOk = (key: string, scope: Scope) => scope === "community" || key === "you";

/* ---------- filtering ---------- */
export function filterJourneys(ds: AnalyticsDataset, f: Pick<Filters, "scope" | "mode">, r: Range, opts?: { ignoreMode?: boolean }): Journey[] {
  return ds.journeys.filter((j) => inRange(j.day, r) && scopeOk(j.userKey, f.scope) && (opts?.ignoreMode || f.mode === "all" || j.mode === f.mode));
}

/** With a mode filter on, only facts attributable to that mode survive (redemptions, top-ups and on-chain events carry no mode). */
export function filterRewards(ds: AnalyticsDataset, f: Pick<Filters, "scope" | "mode">, r: Range): RewardFact[] {
  return ds.rewards.filter((x) => inRange(x.day, r) && scopeOk(x.userKey, f.scope) && (f.mode === "all" || x.mode === f.mode));
}

/* ---------- totals ---------- */
export interface Totals {
  journeys: number;
  verified: number;
  unverified: number;
  /** Verified-only aggregates (see definitions). */
  distanceKm: number;
  baselineG: number;
  actualG: number;
  avoidedG: number;
  clean: number;
  commuters: number;
}

export function totalsOf(js: Journey[]): Totals {
  const t: Totals = { journeys: js.length, verified: 0, unverified: 0, distanceKm: 0, baselineG: 0, actualG: 0, avoidedG: 0, clean: 0, commuters: 0 };
  const users = new Set<string>();
  for (const j of js) {
    if (!j.verified) {
      t.unverified++;
      continue;
    }
    t.verified++;
    t.distanceKm += j.distanceKm;
    t.baselineG += j.baselineG;
    t.actualG += j.actualG;
    t.avoidedG += j.avoidedG;
    if (isClean(j.mode)) t.clean++;
    users.add(j.userKey);
  }
  t.commuters = users.size;
  return t;
}

export interface RewardTotals {
  earned: number;
  pending: number;
  redeemed: number;
}
export function rewardTotals(rs: RewardFact[]): RewardTotals {
  const t = { earned: 0, pending: 0, redeemed: 0 };
  for (const r of rs) t[r.kind] += r.amount;
  return t;
}

export const cleanShare = (t: Totals) => (t.verified > 0 ? t.clean / t.verified : null);
export const verifiedShare = (t: Totals) => (t.journeys > 0 ? t.verified / t.journeys : null);

/** Relative change, or null when there is no previous value to compare against (never invented). */
export function pctChange(cur: number, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** True when `prev` lies inside the dataset's coverage AND something existed in it. */
export function hasComparison(ds: AnalyticsDataset, r: Range, prevTotals: Totals, prevRewards: RewardTotals): boolean {
  const p = prevRange(r);
  if (p.start < ds.coverageStart) return false;
  return prevTotals.journeys > 0 || prevRewards.earned + prevRewards.redeemed + prevRewards.pending > 0;
}

/* ---------- buckets ---------- */
export interface Bucket {
  index: number;
  start: number;
  end: number;
  label: string;
  long: string;
}

/** Day buckets up to ~a month, otherwise weeks / fortnights, so charts stay readable. */
export const bucketSize = (days: number) => (days <= 31 ? 1 : days <= 100 ? 7 : 14);

export function makeBuckets(r: Range): Bucket[] {
  const size = bucketSize(rangeDays(r));
  const out: Bucket[] = [];
  for (let s = r.start, i = 0; s <= r.end; s = addDays(s, size), i++) {
    const e = Math.min(addDays(s, size - 1), r.end);
    out.push({ index: i, start: s, end: e, label: labelDay(s), long: size === 1 ? labelDay(s) : `${labelDay(s)} – ${labelDay(e)}` });
  }
  return out;
}
const bucketIndex = (day: number, r: Range) => Math.floor(diffDays(r.start, day) / bucketSize(rangeDays(r)));

export interface EmissionPoint {
  label: string;
  long: string;
  baselineKg: number;
  actualKg: number;
  avoidedKg: number;
  journeys: number;
}
export function emissionSeries(js: Journey[], r: Range): EmissionPoint[] {
  const b = makeBuckets(r);
  const pts: EmissionPoint[] = b.map((x) => ({ label: x.label, long: x.long, baselineKg: 0, actualKg: 0, avoidedKg: 0, journeys: 0 }));
  for (const j of js) {
    if (!j.verified) continue;
    const p = pts[bucketIndex(j.day, r)];
    if (!p) continue;
    p.baselineKg += j.baselineG / 1000;
    p.actualKg += j.actualG / 1000;
    p.avoidedKg += j.avoidedG / 1000;
    p.journeys++;
  }
  return pts;
}

export interface RewardPoint {
  label: string;
  long: string;
  earned: number;
  pending: number;
  redeemed: number;
}
export function rewardSeries(rs: RewardFact[], r: Range): RewardPoint[] {
  const b = makeBuckets(r);
  const pts: RewardPoint[] = b.map((x) => ({ label: x.label, long: x.long, earned: 0, pending: 0, redeemed: 0 }));
  for (const f of rs) {
    const p = pts[bucketIndex(f.day, r)];
    if (p) p[f.kind] += f.amount;
  }
  return pts;
}

/** Per-bucket values used by the KPI sparklines. */
export function sparkSeries(js: Journey[], rs: RewardFact[], r: Range) {
  const n = makeBuckets(r).length;
  const avoided = new Array<number>(n).fill(0);
  const verified = new Array<number>(n).fill(0);
  const distance = new Array<number>(n).fill(0);
  const rewards = new Array<number>(n).fill(0);
  const users = Array.from({ length: n }, () => new Set<string>());
  for (const j of js) {
    if (!j.verified) continue;
    const i = bucketIndex(j.day, r);
    if (i < 0 || i >= n) continue;
    avoided[i] += j.avoidedG / 1000;
    verified[i]++;
    distance[i] += j.distanceKm;
    users[i].add(j.userKey);
  }
  for (const f of rs) {
    const i = bucketIndex(f.day, r);
    if (f.kind === "earned" && i >= 0 && i < n) rewards[i] += f.amount;
  }
  return { avoided, verified, distance, commuters: users.map((s) => s.size), rewards };
}

/* ---------- mode distribution ---------- */
export interface ModeSlice {
  mode: ModeId;
  label: string;
  color: string;
  trips: number;
  share: number;
  distanceKm: number;
  actualG: number;
}
export function modeBreakdown(js: Journey[]): { slices: ModeSlice[]; total: number } {
  const acc = Object.fromEntries(MODE_IDS.map((m) => [m, { trips: 0, distanceKm: 0, actualG: 0 }])) as Record<ModeId, { trips: number; distanceKm: number; actualG: number }>;
  let total = 0;
  for (const j of js) {
    if (!j.verified) continue;
    acc[j.mode].trips++;
    acc[j.mode].distanceKm += j.distanceKm;
    acc[j.mode].actualG += j.actualG;
    total++;
  }
  return {
    total,
    slices: MODE_IDS.map((m) => ({ mode: m, label: MODES[m].label, color: MODES[m].color, ...acc[m], share: total ? acc[m].trips / total : 0 })),
  };
}

/* ---------- daily activity (heatmap) ---------- */
export interface DayCell {
  day: number;
  journeys: number;
  distanceKm: number;
  avoidedG: number;
  tokens: number;
  inRange: boolean;
  /** Not a real day of the grid (padding before the first / after the last date). */
  blank: boolean;
}
export interface HeatGrid {
  weeks: DayCell[][];
  max: number;
  from: number;
  to: number;
}

/** A calendar grid (columns = Mon-first weeks) that always shows at least twelve weeks ending at the selected range. */
export function heatGrid(js: Journey[], r: Range, today: number): HeatGrid {
  const byDay = new Map<number, { journeys: number; distanceKm: number; avoidedG: number; tokens: number }>();
  for (const j of js) {
    if (!j.verified) continue;
    const cur = byDay.get(j.day) ?? { journeys: 0, distanceKm: 0, avoidedG: 0, tokens: 0 };
    cur.journeys++;
    cur.distanceKm += j.distanceKm;
    cur.avoidedG += j.avoidedG;
    cur.tokens += j.tokens;
    byDay.set(j.day, cur);
  }
  const from = startOfWeek(Math.min(r.start, addDays(r.end, -83)));
  const weeks: DayCell[][] = [];
  let max = 0;
  for (let ws = from; ws <= r.end; ws = addDays(ws, 7)) {
    const week: DayCell[] = [];
    for (let k = 0; k < 7; k++) {
      const day = addDays(ws, k);
      const v = byDay.get(day);
      const blank = day > r.end || day > today;
      week.push({ day, journeys: v?.journeys ?? 0, distanceKm: v?.distanceKm ?? 0, avoidedG: v?.avoidedG ?? 0, tokens: v?.tokens ?? 0, inRange: inRange(day, r), blank });
      if (!blank && v) max = Math.max(max, v.journeys);
    }
    weeks.push(week);
  }
  return { weeks, max, from, to: r.end };
}

/* ---------- streak, score, leaderboard ---------- */
function cleanDaysByUser(ds: AnalyticsDataset): Map<string, Set<number>> {
  const m = new Map<string, Set<number>>();
  for (const j of ds.journeys) {
    if (!j.verified || !isClean(j.mode)) continue;
    let s = m.get(j.userKey);
    if (!s) m.set(j.userKey, (s = new Set()));
    s.add(j.day);
  }
  return m;
}

/** Consecutive days (ending at `end`, or the day before when `end` has none yet) with ≥1 verified clean journey. */
export function streakAt(days: Set<number> | undefined, end: number): number {
  if (!days) return 0;
  let d = days.has(end) ? end : addDays(end, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Mobility score 0–100: 50% clean-journey share, 30% clean streak (capped at 14 days), 20% share of baseline emissions avoided. */
export function mobilityScore(cleanShareV: number, streak: number, avoidedFraction: number): number {
  return Math.round(100 * (0.5 * cleanShareV + 0.3 * (Math.min(streak, 14) / 14) + 0.2 * Math.min(1, Math.max(0, avoidedFraction))));
}

export interface LeaderRow {
  /** null = fewer than MIN_RANKED_JOURNEYS verified journeys in the period. */
  rank: number | null;
  key: string;
  alias: string;
  archetype: string;
  isYou: boolean;
  isDemo: boolean;
  verified: number;
  avoidedG: number;
  baselineG: number;
  distanceKm: number;
  cleanShare: number;
  streak: number;
  score: number;
  activeDays: number;
  lastActive: number;
  modeShare: Record<ModeId, number>;
}

export function leaderboard(ds: AnalyticsDataset, r: Range): LeaderRow[] {
  const streaks = cleanDaysByUser(ds);
  const per = new Map<string, Journey[]>();
  for (const j of ds.journeys) {
    if (!j.verified || !inRange(j.day, r)) continue;
    let a = per.get(j.userKey);
    if (!a) per.set(j.userKey, (a = []));
    a.push(j);
  }
  const rows: LeaderRow[] = [];
  for (const c of ds.commuters) {
    const js = per.get(c.key);
    if (!js?.length) continue;
    const t = totalsOf(js);
    const share = t.clean / t.verified;
    const streak = streakAt(streaks.get(c.key), r.end);
    const modeShare = Object.fromEntries(MODE_IDS.map((m) => [m, 0])) as Record<ModeId, number>;
    for (const j of js) modeShare[j.mode] += 1 / js.length;
    rows.push({
      rank: null,
      key: c.key,
      alias: c.alias,
      archetype: c.archetype,
      isYou: c.isYou,
      isDemo: c.isDemo,
      verified: t.verified,
      avoidedG: t.avoidedG,
      baselineG: t.baselineG,
      distanceKm: t.distanceKm,
      cleanShare: share,
      streak,
      score: mobilityScore(share, streak, t.baselineG > 0 ? t.avoidedG / t.baselineG : 0),
      activeDays: new Set(js.map((j) => j.day)).size,
      lastActive: Math.max(...js.map((j) => j.day)),
      modeShare,
    });
  }
  const ranked = rows
    .filter((x) => x.verified >= MIN_RANKED_JOURNEYS)
    .sort((a, b) => b.score - a.score || b.avoidedG - a.avoidedG || b.verified - a.verified || a.alias.localeCompare(b.alias));
  ranked.forEach((x, i) => (x.rank = i + 1));
  const unranked = rows.filter((x) => x.verified < MIN_RANKED_JOURNEYS).sort((a, b) => b.verified - a.verified || a.alias.localeCompare(b.alias));
  return [...ranked, ...unranked];
}

/* ---------- planner insights ---------- */
export interface ActivityPattern {
  byWeekday: number[];
  weekendShare: number | null;
  busiest: { name: string; share: number } | null;
}
export function activityPattern(js: Journey[]): ActivityPattern {
  const byWeekday = new Array<number>(7).fill(0);
  let n = 0;
  for (const j of js) {
    if (!j.verified) continue;
    byWeekday[weekdayIndex(j.day)]++;
    n++;
  }
  if (!n) return { byWeekday, weekendShare: null, busiest: null };
  const top = byWeekday.indexOf(Math.max(...byWeekday));
  return { byWeekday, weekendShare: (byWeekday[5] + byWeekday[6]) / n, busiest: { name: WEEKDAYS_LONG[top], share: byWeekday[top] / n } };
}

export const originOf = (js: Journey[]): "demo" | "session" | "mixed" | "none" => {
  const d = js.some((j) => j.origin === "demo");
  const s = js.some((j) => j.origin === "session");
  return d && s ? "mixed" : d ? "demo" : s ? "session" : "none";
};
