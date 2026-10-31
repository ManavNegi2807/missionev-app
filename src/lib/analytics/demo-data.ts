import { fnv1a } from "@/lib/format";
import { CATALOG } from "@/lib/rewards/catalog";
import { journeyImpact, type VehicleVariant } from "./impact";
import { MODE_IDS, type ModeId } from "./modes";
import { addDays, DAY_MS, weekdayIndex } from "./time";
import type { Commuter, Journey, RewardFact } from "./types";

/**
 * DEMO COMMUNITY — a deterministic synthetic dataset. Nothing here was measured; no real person is
 * represented. Aliases are invented, and the data is generated from a seeded PRNG so the same calendar
 * day always produces the same numbers. Impact figures use the same emission maths as Screen 02.
 */
export const COVERAGE_DAYS = 200;
export const MIN_RANKED_JOURNEYS = 3;

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Archetype = "metro" | "ev" | "active" | "mixed" | "petrol" | "diesel";
const ARCHETYPE_LABEL: Record<Archetype, string> = {
  metro: "Metro regular",
  ev: "EV rider",
  active: "Walker / cyclist",
  mixed: "Mixed commuter",
  petrol: "Petrol rider",
  diesel: "Diesel / SUV driver",
};
const WEIGHTS: Record<Archetype, Record<ModeId, number>> = {
  metro: { ev: 0, petrol: 0.1, diesel: 0, metro: 0.7, ebus: 0.1, active: 0.1 },
  ev: { ev: 0.82, petrol: 0, diesel: 0, metro: 0.08, ebus: 0, active: 0.1 },
  active: { ev: 0, petrol: 0, diesel: 0, metro: 0.2, ebus: 0.2, active: 0.6 },
  mixed: { ev: 0.25, petrol: 0.2, diesel: 0, metro: 0.25, ebus: 0.15, active: 0.15 },
  petrol: { ev: 0, petrol: 0.78, diesel: 0, metro: 0.15, ebus: 0.07, active: 0 },
  diesel: { ev: 0, petrol: 0.15, diesel: 0.62, metro: 0.18, ebus: 0.05, active: 0 },
};
const MIX: Array<[Archetype, number]> = [["metro", 8], ["ev", 9], ["active", 6], ["mixed", 10], ["petrol", 6], ["diesel", 3]];

const ADJ = ["Teal", "Amber", "Jade", "Cobalt", "Saffron", "Indigo", "Coral", "Olive", "Slate", "Violet", "Marigold", "Cedar"];
const BIRD = ["Heron", "Lynx", "Kite", "Otter", "Ibis", "Gecko", "Finch", "Panther", "Mynah", "Egret", "Sambar", "Dhole"];

interface DemoCommuter extends Commuter {
  archetype: Archetype;
  weights: Record<ModeId, number>;
  consistency: number;
  /** Days before "today" the commuter joined (200+ = before the dataset window). */
  joinAgo: number;
  evVariant: VehicleVariant;
  petrolVariant: VehicleVariant;
}

function makeCommuters(): DemoCommuter[] {
  const list: DemoCommuter[] = [];
  const used = new Set<string>();
  let i = 0;
  for (const [arch, n] of MIX) {
    for (let k = 0; k < n; k++, i++) {
      const h = fnv1a(`missionev-demo-commuter-${i}`);
      let alias = `${ADJ[h % ADJ.length]} ${BIRD[(h >>> 4) % BIRD.length]} ${10 + ((h >>> 8) % 90)}`;
      while (used.has(alias)) alias = `${alias}x`;
      used.add(alias);
      const r = rng(h);
      list.push({
        key: `demo-${String(i + 1).padStart(2, "0")}`,
        alias,
        archetype: arch,
        isYou: false,
        isDemo: true,
        weights: WEIGHTS[arch],
        consistency: 0.55 + r() * 0.37,
        joinAgo: r() < 0.58 ? COVERAGE_DAYS + 10 : Math.floor(r() * 170),
        evVariant: r() < 0.72 ? "ev-scooter" : "ev-car",
        petrolVariant: (["petrol-bike", "petrol-scooter", "petrol-car"] as const)[Math.floor(r() * 3)],
      });
    }
  }
  return list;
}

function pickMode(w: Record<ModeId, number>, r: () => number): ModeId {
  let x = r();
  for (const m of MODE_IDS) {
    x -= w[m];
    if (x <= 0) return m;
  }
  return "metro";
}

const DISTANCE: Record<string, [number, number]> = {
  "ev-scooter": [4, 14],
  "ev-car": [6, 25],
  "petrol-bike": [4, 16],
  "petrol-scooter": [3, 12],
  "petrol-car": [6, 30],
  "diesel-suv": [8, 35],
  metro: [6, 28],
  ebus: [4, 18],
  active: [0.8, 5],
};

export interface DemoData {
  commuters: Commuter[];
  journeys: Journey[];
  rewards: RewardFact[];
}

export function generateDemo(today: number): DemoData {
  const commuters = makeCommuters();
  const journeys: Journey[] = [];
  const rewards: RewardFact[] = [];

  for (const c of commuters) {
    let balance = 0;
    const joinDay = addDays(today, -c.joinAgo);
    for (let back = COVERAGE_DAYS - 1; back >= 0; back--) {
      const day = addDays(today, -back);
      if (day < joinDay) continue;
      const epoch = Math.round(day / DAY_MS);
      const r = rng(fnv1a(`${c.key}|${epoch}`));
      const p = weekdayIndex(day) < 5 ? c.consistency : c.consistency * 0.28;
      if (r() > p) continue;

      const legs = r() < 0.72 ? 2 : 1;
      let mode = pickMode(c.weights, r);
      for (let leg = 0; leg < legs; leg++) {
        if (leg > 0 && r() > 0.85) mode = pickMode(c.weights, r);
        const variant: VehicleVariant | undefined = mode === "ev" ? c.evVariant : mode === "petrol" ? c.petrolVariant : mode === "diesel" ? "diesel-suv" : undefined;
        const [lo, hi] = DISTANCE[variant ?? mode];
        const distanceKm = Math.round((lo + r() * (hi - lo)) * 10) / 10;
        const verified = r() > 0.06;
        const id = `${c.key}-${epoch}-${leg}`;
        if (!verified) {
          journeys.push({ id, day, userKey: c.key, mode, distanceKm, baselineG: 0, actualG: 0, avoidedG: 0, verified: false, tokens: 0, origin: "demo" });
          continue;
        }
        const impact = journeyImpact({ mode, variant, distanceKm });
        journeys.push({ id, day, userKey: c.key, mode, distanceKm, ...impact, verified: true, origin: "demo" });
        if (impact.tokens > 0) {
          // Today's journeys are "pending" (not recorded on the ledger yet); older ones are earned.
          const pending = day >= today;
          rewards.push({ id: `${id}-r`, day, userKey: c.key, kind: pending ? "pending" : "earned", amount: impact.tokens, mode, origin: "demo" });
          if (!pending) balance += impact.tokens;
        }
      }

      // Occasionally spend a balance on a (demo) catalogue item.
      if (balance >= 40 && r() < 0.05) {
        const affordable = CATALOG.filter((it) => it.cost <= balance);
        if (affordable.length) {
          const total = affordable.reduce((n, it) => n + it.popularity, 0);
          let x = r() * total;
          const item = affordable.find((it) => (x -= it.popularity) <= 0) ?? affordable[0];
          balance -= item.cost;
          rewards.push({ id: `${c.key}-${epoch}-rd`, day, userKey: c.key, kind: "redeemed", amount: item.cost, origin: "demo", label: item.name });
        }
      }
    }
  }
  return {
    commuters: commuters.map((c) => ({ key: c.key, alias: c.alias, archetype: ARCHETYPE_LABEL[c.archetype as Archetype], isYou: false, isDemo: true })),
    journeys,
    rewards,
  };
}
