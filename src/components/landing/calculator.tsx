"use client";

import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Bus, Footprints, Fuel, TrainFront, TriangleAlert, Zap } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn, formatNumber } from "@/lib/format";
import { MAX_KM, MIN_KM, SAMPLE_MODES, STREAK_STEPS, sampleJourney, type SampleModeId } from "@/lib/landing/sample";

const ICONS: Record<SampleModeId, ReactNode> = {
  metro: <TrainFront aria-hidden className="size-5" />,
  ebus: <Bus aria-hidden className="size-5" />,
  active: <Footprints aria-hidden className="size-5" />,
  ev_car: <Zap aria-hidden className="size-5" />,
  petrol_car: <Fuel aria-hidden className="size-5" />,
};

const chip =
  "flex cursor-pointer items-center rounded-xl border border-line bg-panel text-sm transition hover:border-line-strong peer-checked:border-lime peer-checked:bg-lime/[0.08] peer-checked:text-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan";

/**
 * "Try the maths": the app's real emissions engine and reward formula over a few sample journeys. The sample vehicles are
 * illustrative; the app uses the commuter's own. Radios and a range input keep it keyboard and screen-reader friendly.
 */
export function Calculator() {
  const uid = useId();
  const [mode, setMode] = useState<SampleModeId>("metro");
  const [km, setKm] = useState(12);
  const [streak, setStreak] = useState<number>(1);
  const r = useMemo(() => sampleJourney(mode, km, streak), [mode, km, streak]);

  const ref = r.referenceGrams || 1;
  const actualPct = Math.min(100, (r.actualGrams / ref) * 100);
  const fill = ((km - MIN_KM) / (MAX_KM - MIN_KM)) * 100;
  const modeLabel = SAMPLE_MODES.find((m) => m.id === mode)?.label ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-7 rounded-3xl border border-line bg-panel p-5 shadow-panel sm:p-7">
        <fieldset>
          <legend className="section-label mb-3">1 · How did you travel?</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {SAMPLE_MODES.map((m) => (
              <label key={m.id} className="relative">
                <input type="radio" name={`${uid}-mode`} value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} className="peer sr-only" />
                <span className={cn(chip, "gap-2.5 px-3.5 py-3", mode === m.id ? "text-fg" : "text-muted")}>
                  <span className={mode === m.id ? "text-lime" : ""}>{ICONS[m.id]}</span>
                  {m.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="mb-3 flex items-end justify-between">
            <label htmlFor={`${uid}-km`} className="section-label">
              2 · How far?
            </label>
            <output htmlFor={`${uid}-km`} className="text-2xl font-semibold tabular-nums">
              {km} <span className="font-mono text-sm font-normal text-muted">km</span>
            </output>
          </div>
          <input
            id={`${uid}-km`}
            type="range"
            min={MIN_KM}
            max={MAX_KM}
            step={0.5}
            value={km}
            onChange={(e) => setKm(Number(e.target.value))}
            aria-valuetext={`${km} kilometres`}
            className="lp-range w-full"
            style={{ "--fill": `${fill}%` } as React.CSSProperties}
          />
          <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
            <span>{MIN_KM} km</span>
            <span>{MAX_KM} km</span>
          </div>
        </div>

        <fieldset>
          <legend className="section-label mb-3">3 · Your streak</legend>
          <div className="grid grid-cols-4 gap-2">
            {STREAK_STEPS.map((d) => (
              <label key={d} className="relative">
                <input type="radio" name={`${uid}-streak`} value={d} checked={streak === d} onChange={() => setStreak(d)} className="peer sr-only" />
                <span className={cn(chip, "flex-col justify-center px-1 py-2.5 text-center whitespace-nowrap", streak === d ? "text-fg" : "text-muted")}>
                  <span className="font-semibold tabular-nums">Day {d}</span>
                  <span className="font-mono text-[11px] text-muted">{sampleJourney(mode, km, d).multiplier}×</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Riding on consecutive days multiplies the base reward: 1×, 1.5× at 5 days, 2× at 10, 3× at 20.</p>
        </fieldset>
      </div>

      <div className="flex flex-col rounded-3xl border border-line bg-panel p-5 shadow-panel sm:p-7" aria-live="polite" data-calc-result>
        <p className="section-label">What MissionEV calculates</p>

        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">Reference: {r.referenceLabel}</span>
              <span className="font-mono tabular-nums">{formatNumber(Math.round(r.referenceGrams))} g</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-fg/[0.07]">
              <div className="lp-bar h-full rounded-full bg-warn/70" style={{ width: "100%" }} />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span>Your {modeLabel.toLowerCase()} journey</span>
              <span className="font-mono tabular-nums">{formatNumber(Math.round(r.actualGrams))} g</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-fg/[0.07]">
              <div className={cn("lp-bar h-full rounded-full", r.eligible ? "bg-lime" : "bg-warn")} style={{ width: `${Math.max(actualPct, r.actualGrams > 0 ? 1.5 : 0)}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-4 border-t border-line pt-6">
          <div>
            <p className="section-label">CO₂ avoided</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              <AnimatedNumber value={r.avoidedGrams} decimals={0} />
              <span className="ml-1 font-mono text-base font-normal text-muted">g</span>
            </p>
          </div>
          <div>
            <p className="section-label">$MEV preview</p>
            <p className={cn("mt-2 text-4xl font-semibold tracking-tight sm:text-5xl", r.eligible ? "text-lime" : "text-muted")}>
              <AnimatedNumber value={r.mev} decimals={1} />
            </p>
          </div>
        </div>

        {r.eligible ? (
          <p className="mt-5 font-mono text-[11.5px] leading-relaxed break-words text-muted">{r.formula}</p>
        ) : (
          <div className="mt-5 flex gap-3 rounded-xl border border-warn/40 bg-warn/[0.08] p-3.5 text-sm" role="status">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            <p>
              <span className="font-semibold">Measured, not rewarded.</span> {r.reason}
            </p>
          </div>
        )}

        <div className="mt-auto pt-6">
          <p className="text-xs leading-relaxed text-muted">
            Same engine and reward formula as the app. Sample vehicles are illustrative: the app uses your own. $MEV is a prototype reward token, not a certified carbon credit.
          </p>
          <Link href="/register" className="group mt-4 inline-flex items-center gap-2 font-mono text-xs tracking-[0.1em] text-lime uppercase hover:underline">
            Do it with your own trips
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
