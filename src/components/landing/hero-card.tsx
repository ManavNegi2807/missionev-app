import { BadgeCheck, CircleDashed, Coins, Flame, Footprints, Bus, Leaf, TrainFront, Zap } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { sampleJourney } from "@/lib/landing/sample";

const ROUTE = "M10 72 C 48 72, 58 30, 104 36 S 168 80, 204 50 S 238 22, 250 26";
const SAMPLE = sampleJourney("metro", 12.4, 1);
const SAMPLE_STREAK = sampleJourney("metro", 12.4, 5);

function Chip({ className, depth, delay, children }: { className: string; depth: number; delay: string; children: React.ReactNode }) {
  return (
    <div className={`lp-layer absolute z-10 hidden sm:block ${className}`} style={{ "--d": depth } as React.CSSProperties}>
      <div
        className="lp-float glass flex items-center gap-2 rounded-2xl border border-line-strong px-3 py-2 text-xs shadow-panel"
        style={{ "--fd": delay } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

function ModeBubble({ className, depth, delay, children }: { className: string; depth: number; delay: string; children: React.ReactNode }) {
  return (
    <div className={`lp-layer absolute z-10 hidden sm:block ${className}`} style={{ "--d": depth } as React.CSSProperties}>
      <div
        className="lp-float glass grid size-11 place-items-center rounded-full border border-line-strong text-lime shadow-panel"
        style={{ "--fd": delay } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

/** A sample verified journey, calculated by the same engine the app uses. It tilts toward the cursor (see .lp-tilt). */
export function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] py-6 sm:py-10">
      <ModeBubble className="top-0 left-8" depth={34} delay="0s">
        <TrainFront aria-hidden className="size-5" />
      </ModeBubble>
      <ModeBubble className="top-0 right-4" depth={-26} delay="1.2s">
        <Zap aria-hidden className="size-5" />
      </ModeBubble>
      <ModeBubble className="bottom-0 left-12" depth={30} delay="2.1s">
        <Bus aria-hidden className="size-5" />
      </ModeBubble>
      <ModeBubble className="top-[58%] -left-8" depth={-34} delay="0.6s">
        <Footprints aria-hidden className="size-5" />
      </ModeBubble>

      <Chip className="top-[22%] -left-6 xl:-left-16" depth={-22} delay="0.4s">
        <Leaf aria-hidden className="size-4 text-lime" />
        <span>
          <span className="block font-mono text-[10px] tracking-[0.14em] text-muted uppercase">CO₂ avoided</span>
          <span className="font-semibold tabular-nums">{formatNumber(SAMPLE.avoidedGrams)} g</span>
        </span>
      </Chip>
      <Chip className="right-6 bottom-1" depth={26} delay="1.6s">
        <Flame aria-hidden className="size-4 text-warn" />
        <span>
          <span className="block font-mono text-[10px] tracking-[0.14em] text-muted uppercase">5-day streak</span>
          <span className="font-semibold tabular-nums">{SAMPLE_STREAK.multiplier}× rewards</span>
        </span>
      </Chip>

      <div className="lp-layer" style={{ "--d": 6 } as React.CSSProperties}>
        <div className="lp-tilt relative overflow-hidden rounded-3xl border border-line-strong bg-panel shadow-[0_30px_70px_-30px_color-mix(in_srgb,var(--color-shade)_55%,transparent)]" data-hero-card>
          <div aria-hidden className="lp-glare pointer-events-none absolute inset-0 z-10" />

          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <span className="grid size-10 place-items-center rounded-xl border border-lime/40 bg-lime/[0.1] text-lime">
              <TrainFront aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Metro commute</p>
              <p className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">Sample journey</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/[0.08] px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-ok uppercase">
              <BadgeCheck aria-hidden className="size-3.5" /> Verified
            </span>
          </div>

          <div className="px-5 pt-4">
            <svg viewBox="0 0 260 96" className="h-28 w-full" role="img" aria-label="A route drawn from a start point to an end point">
              <path d={ROUTE} fill="none" stroke="var(--color-line-strong)" strokeWidth="6" strokeLinecap="round" />
              <path d={ROUTE} fill="none" stroke="var(--color-lime)" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" className="route-flow" />
              <circle cx="10" cy="72" r="6" fill="var(--color-panel)" stroke="var(--color-cyan)" strokeWidth="3" />
              <circle cx="250" cy="26" r="6" fill="var(--color-lime)" />
              <circle cx="250" cy="26" r="6" fill="var(--color-lime)" className="pulse-ring" />
              <circle r="5" fill="var(--color-bg)" stroke="var(--color-lime)" strokeWidth="2.5" className="lp-dot" style={{ offsetPath: `path("${ROUTE}")` }} />
            </svg>
          </div>

          <dl className="grid grid-cols-3 gap-3 px-5 pt-1 pb-4 text-sm">
            <div>
              <dt className="section-label">Distance</dt>
              <dd className="mt-1 font-semibold tabular-nums">{SAMPLE.km} km</dd>
            </div>
            <div>
              <dt className="section-label">Emitted</dt>
              <dd className="mt-1 font-semibold tabular-nums">{formatNumber(Math.round(SAMPLE.actualGrams))} g</dd>
            </div>
            <div>
              <dt className="section-label">Reference</dt>
              <dd className="mt-1 font-semibold text-muted tabular-nums">{formatNumber(Math.round(SAMPLE.referenceGrams))} g</dd>
            </div>
          </dl>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-bg-2/70 px-5 py-4">
            <div>
              <p className="section-label">Reward preview</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <Coins aria-hidden className="size-4 self-center text-lime" />
                <span className="text-2xl font-semibold tabular-nums">+{SAMPLE.mev.toFixed(1)}</span>
                <span className="font-mono text-xs text-muted">$MEV</span>
              </p>
            </div>
            <ol className="space-y-1 text-[11px] text-muted" aria-label="Where this journey is in the pipeline">
              <li className="flex items-center gap-1.5">
                <BadgeCheck aria-hidden className="size-3.5 text-ok" /> Verified by the oracle
              </li>
              <li className="flex items-center gap-1.5">
                <BadgeCheck aria-hidden className="size-3.5 text-ok" /> Signed (EIP-712)
              </li>
              <li className="flex items-center gap-1.5">
                <CircleDashed aria-hidden className="size-3.5" /> Sent by your wallet
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
