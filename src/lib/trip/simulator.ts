import { fnv1a } from "@/lib/format";
import { offsetRight, pointAtKm } from "./geo";
import type { DemoRoute } from "./demo-routes";
import type { SpeedClass } from "./travel";
import type { GpsSample, Scenario } from "./types";

/** Simulated seconds that pass per real second while a demo trip runs. */
export const SIM_SCALE = 40;

/** Deterministic pseudo-noise in [-0.5, 0.5). */
export function noise(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

const BASE_SPEED: Record<SpeedClass, number> = {
  two_wheeler: 26,
  car: 30,
  metro: 42,
  ebus: 20,
  active: 6,
};

/** Simulated speed (km/h): ramps up from rest, dips at "signals" (stations / junctions), with smooth deterministic variation. */
export function simSpeedKmh(speedClass: SpeedClass, seed: number, progressKm: number, lengthKm: number): number {
  const base = BASE_SPEED[speedClass];
  const ramp = Math.min(1, 0.3 + 0.7 * Math.min(progressKm / 0.4, (lengthKm - progressKm) / 0.4));
  const z = ((progressKm % 1.9) - 1.5) / 0.09;
  const signal = 1 - 0.82 * Math.exp(-(z * z));
  const wobble = 1 + 0.22 * Math.sin(progressKm * 2.3 + seed) + 0.1 * noise(seed, Math.floor(progressKm * 8));
  return Math.max(3, base * ramp * signal * wobble);
}

export interface SimSampleInput {
  route: DemoRoute;
  progressKm: number;
  tMs: number;
  seed: number;
  index: number;
  scenario: Scenario;
  prevT: number | null;
  speedKmh: number;
}

/** Build a SIMULATED sample. Every sample from here is flagged by the caller as simulated, never as GPS. */
export function simSample(i: SimSampleInput): GpsSample {
  const { pos, heading } = pointAtKm(i.route.points, i.route.cum, i.progressKm);
  const frac = i.progressKm / i.route.lengthKm;

  let p = pos;
  if (i.scenario === "route-mismatch" && frac > 0.3 && frac < 0.7) {
    p = offsetRight(p, heading, 900 * Math.sin((Math.PI * (frac - 0.3)) / 0.4));
  }
  // ~±4 m of seeded jitter so two runs of the same route never share an identical sample sequence.
  p = { lat: p.lat + noise(i.seed, i.index * 2) * 8e-5, lng: p.lng + noise(i.seed, i.index * 2 + 1) * 8e-5 };

  // Replay anomaly: the clock stops advancing for the second half of the trip.
  const t = i.scenario === "gps-replay" && frac > 0.5 && i.prevT !== null ? i.prevT : i.tMs;

  return { lat: p.lat, lng: p.lng, t, speedKmh: i.speedKmh };
}

export const seedFromId = (id: string) => (fnv1a(id) % 9973) / 97;
