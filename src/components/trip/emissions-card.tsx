"use client";

import { Calculator, Leaf } from "lucide-react";
import { Badge, Panel } from "@/components/ui/primitives";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EMISSION_CONFIG } from "@/lib/trip/emissions";
import { useTrip } from "@/providers/trip-provider";

const g = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

function Row({ label, value, unit, strong, note }: { label: string; value: string; unit?: string; strong?: boolean; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="min-w-0 text-sm text-muted">
        {label}
        {note && <span className="block text-[11px] text-muted/70">{note}</span>}
      </dt>
      <dd className={`shrink-0 text-right font-mono text-sm ${strong ? "font-semibold text-lime" : "text-fg"}`}>
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

export function EmissionsCard() {
  const { record, status } = useTrip();
  const e = record?.emissions ?? null;

  return (
    <Panel aria-labelledby="calc-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div>
          <p className="section-label mb-1">Process 4.0 · Calculate CO₂ &amp; tokens</p>
          <h2 id="calc-title" className="text-[15px] font-semibold tracking-[0.06em] uppercase">
            Emissions calculation
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="warn">Illustrative</Badge>
          {e?.isDemo && <Badge tone="warn">Demo</Badge>}
        </div>
      </header>

      {!e ? (
        <div className="flex items-start gap-3 p-4 text-sm text-muted sm:p-6">
          <Calculator aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            {status === "FAILED"
              ? "No calculation: the trip was not verified, so no emissions or rewards are produced."
              : "Appears after a trip is verified. Formula: estimated emissions = distance × emission factor."}
          </p>
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="rounded-xl border border-line bg-bg-2/60 p-3 font-mono text-[11.5px] leading-relaxed text-muted">
            <p>
              <span className="text-fg">{g(e.distanceKm)} km</span> × <span className="text-cyan">{g(e.factorGPerKm)} g/km</span> ={" "}
              <span className="text-lime">{g(e.estimatedG)} g CO₂e</span>
            </p>
            <p className="mt-1 break-words">
              basis: {e.vehicleClass} · {e.basis}
              {e.kind === "electric" ? ` · grid ${EMISSION_CONFIG.gridGPerKwh} g/kWh` : ""}
            </p>
          </div>

          {/* Same numbers as the rows below — one calculation result drives every figure. */}
          <figure aria-label="Estimated versus baseline emissions">
            {[
              { label: "Estimated", v: e.estimatedG, cls: "bg-cyan" },
              { label: "Baseline", v: e.baselineG, cls: "bg-muted/60" },
            ].map((b) => {
              const max = Math.max(e.estimatedG, e.baselineG, 1e-9);
              return (
                <div key={b.label} className="mb-2 grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="font-mono text-muted">{b.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-line-strong/40">
                    <span className={`block h-full rounded-full ${b.cls} transition-[width] duration-700`} style={{ width: `${(b.v / max) * 100}%` }} />
                  </span>
                  <span className="font-mono text-fg">{g(b.v, 1)} g</span>
                </div>
              );
            })}
          </figure>

          <dl className="divide-y divide-line/60">
            <Row label="Journey distance" value={g(e.distanceKm)} unit="km" note={`${e.distanceMeters.toLocaleString()} m`} />
            <Row label="Transport mode" value={e.modeLabel} />
            <Row label="Emission factor (applied)" value={g(e.factorGPerKm)} unit="g CO₂e/km" note={e.vehicleClass} />
            {e.kind === "electric" ? (
              <>
                <Row label="Tailpipe emissions" value={g(e.tailpipeG)} unit="g" note="zero at the vehicle" />
                <Row label="Electricity-generation emissions" value={g(e.generationG)} unit="g" note={`${g(e.energyUsed, 3)} kWh × ${EMISSION_CONFIG.gridGPerKwh} g/kWh grid factor`} />
              </>
            ) : (
              <Row label="Tailpipe emissions" value={g(e.tailpipeG)} unit="g" note={`${g(e.energyUsed, 3)} ${e.energyUnit} of fuel`} />
            )}
            <Row label="Estimated journey emissions" value={g(e.estimatedG)} unit="g CO₂e" strong />
            <Row label="Baseline emissions" value={g(e.baselineG)} unit="g CO₂e" note={`petrol bike · ${g(e.baselineGPerKm, 1)} g/km`} />
            <Row
              label="Estimated difference"
              value={`${e.differenceG >= 0 ? "−" : "+"}${g(Math.abs(e.differenceG))}`}
              unit="g"
              note={e.differenceG >= 0 ? "below baseline" : "above baseline — no saving counted"}
            />
            <Row label="Counted saving (whole grams)" value={g(e.savedG, 0)} unit="g" note="contract rule: only below-baseline, floored" />
          </dl>

          <div className="rounded-xl border border-lime/25 bg-lime/[0.04] p-4">
            <div className="flex items-center gap-2 text-lime">
              <Leaf aria-hidden className="size-4" />
              <p className="font-mono text-[11px] tracking-[0.14em]">ILLUSTRATIVE $MEV REWARD</p>
            </div>
            <p className="mt-2 font-mono text-3xl font-semibold text-lime">
              <AnimatedNumber value={e.tokens} decimals={0} /> <span className="text-base text-muted">$MEV</span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              ⌊{e.savedG} g ÷ {EMISSION_CONFIG.gramsPerToken}⌋ = {e.tokensBeforeTrust} × trust {e.trustPercent}% = {e.tokensAfterTrust}
              {e.tokens !== e.tokensAfterTrust ? `, capped to ${e.tokens} (${e.capRemaining} of ${e.dailyCap} daily cap left)` : ` · daily cap ${e.dailyCap}, ${e.capRemaining} left`}.
            </p>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            Reward points only — <strong className="text-fg">not certified carbon credits</strong>. Factors are configurable defaults mirrored from the project’s
            contract (which marks several as DEMO values to be replaced with ARAI / CEA data).
            {e.mapping === "none" && " This vehicle has no class in the contract’s catalogue; its factor is an off-contract illustrative fallback."}
          </p>
        </div>
      )}
    </Panel>
  );
}
