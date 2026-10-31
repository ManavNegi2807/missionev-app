"use client";

import { Calculator, ChevronDown, Leaf, Zap } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Alert, Badge, Panel } from "@/components/ui/primitives";
import { BOUNDARY } from "@/lib/carbon/emissionFactors";
import { EFFICIENCY_SOURCE_LABEL } from "@/lib/carbon/efficiency";
import { TRAVEL_LABEL } from "@/lib/trip/travel";
import { useTrip } from "@/providers/trip-provider";

const g = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const tone = { high: "ok", medium: "cyan", low: "warn" } as const;
const statusTone = { primary: "ok", secondary: "cyan", assumption: "warn" } as const;

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
  const c = record?.carbon ?? null;
  const s = record?.settlement;

  return (
    <Panel aria-labelledby="calc-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div>
          <p className="section-label mb-1">Process 4.0 · Calculate CO₂ &amp; reward</p>
          <h2 id="calc-title" className="text-[15px] font-semibold tracking-[0.06em] uppercase">
            Carbon comparison
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {c && <Badge tone={tone[c.confidence]}>{c.confidence} confidence</Badge>}
          {s && c && <Badge tone={s.applicationMode === "LIVE" ? "ok" : "warn"}>{s.applicationMode}</Badge>}
        </div>
      </header>

      {!c ? (
        <div className="flex items-start gap-3 p-4 text-sm text-muted sm:p-6">
          <Calculator aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            {status === "FAILED"
              ? "No calculation: the trip was not verified, so no emissions or rewards are produced."
              : "Appears after a trip is verified. Your journey is compared with a reference journey of the same distance on one accounting basis."}
          </p>
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-bg-2/60 p-3.5">
              <p className="section-label">Your journey</p>
              <p className="mt-1 text-sm font-medium text-fg">{TRAVEL_LABEL[c.mode]}</p>
              <p className="text-xs text-muted [overflow-wrap:anywhere]">{record?.vehicle?.label ?? "No vehicle involved"} · {g(c.distanceKm)} km</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-cyan">
                {g(c.actual.grams, 1)} <span className="text-xs font-normal text-muted">g CO₂e</span>
              </p>
            </div>
            <div className="rounded-xl border border-line bg-bg-2/60 p-3.5">
              <p className="section-label">Reference journey</p>
              <p className="mt-1 text-sm font-medium text-fg">{c.baseline.label}</p>
              <p className="text-xs text-muted">same distance · same boundary</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-fg">
                {g(c.baseline.grams, 1)} <span className="text-xs font-normal text-muted">g CO₂e</span>
              </p>
            </div>
          </div>

          <figure aria-label="Your journey versus the reference journey">
            {[
              { label: "Yours", v: c.actual.grams, cls: "bg-cyan" },
              { label: "Reference", v: c.baseline.grams, cls: "bg-muted/60" },
            ].map((b) => {
              const max = Math.max(c.actual.grams, c.baseline.grams, 1e-9);
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
            <Row label="Estimated emissions (yours)" value={g(c.actual.grams)} unit="g CO₂e" strong />
            <Row label="Estimated emissions (reference)" value={g(c.baseline.grams)} unit="g CO₂e" />
            <Row
              label="Estimated avoided emissions"
              value={g(c.co2AvoidedGrams, 0)}
              unit="g"
              note={c.exceedsReference ? "your journey emitted more than the reference: nothing is avoided" : "reference − yours, floored to whole grams"}
            />
          </dl>
          {c.exceedsReference && (
            <Alert tone="warn" title="Your journey emitted more than the reference scenario.">
              That is shown honestly. It does not reduce any token balance: the MissionEV contract has no penalty or burn, and a negative number is never sent to it.
            </Alert>
          )}

          {c.evEfficiency && (
            <div className="rounded-xl border border-cyan/25 bg-cyan/[0.04] p-3.5">
              <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-cyan">
                <Zap aria-hidden className="size-3.5" /> EV ENERGY EFFICIENCY
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-3 font-mono text-sm text-fg">
                <div>
                  <dt className="section-label">kWh/100 km</dt>
                  <dd>{g(c.evEfficiency.kWhPer100Km)}</dd>
                </div>
                <div>
                  <dt className="section-label">km/kWh</dt>
                  <dd>{g(c.evEfficiency.kmPerKWh)}</dd>
                </div>
                <div>
                  <dt className="section-label">vs reference</dt>
                  <dd className={c.evEfficiency.betterThanReferencePct >= 0 ? "text-ok" : "text-warn"}>
                    {c.evEfficiency.betterThanReferencePct >= 0 ? "−" : "+"}
                    {g(Math.abs(c.evEfficiency.betterThanReferencePct), 1)}%
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {c.evEfficiency.betterThanReferencePct >= 0 ? "Uses less" : "Uses more"} electricity per km than a {c.evEfficiency.reference.label} ({g(c.evEfficiency.reference.kWhPer100Km)} kWh/100 km). Electricity drawn: {g(c.actual.energy.amount, 3)} kWh.
                Efficiency supports the carbon figure above; it is not a separate reward multiplier, because the contract has none. A bigger battery isn&apos;t more efficient: only kWh per km counts.
              </p>
            </div>
          )}

          <div
            className={`rounded-xl border p-4 ${c.reward.eligible ? "border-lime/25 bg-lime/[0.04]" : "border-line-strong bg-bg-2/60"}`}
          >
            <div className={`flex items-center gap-2 ${c.reward.eligible ? "text-lime" : "text-muted"}`}>
              <Leaf aria-hidden className="size-4" />
              <p className="font-mono text-[11px] tracking-[0.14em]">{c.reward.eligible ? "ILLUSTRATIVE $MEV REWARD PREVIEW" : "NO $MEV FOR THIS JOURNEY"}</p>
            </div>
            {c.reward.eligible && s?.preview ? (
              <>
                <p className="mt-2 font-mono text-3xl font-semibold text-lime">
                  <AnimatedNumber value={s.preview.rewardMev} decimals={2} /> <span className="text-base text-muted">$MEV</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {s.preview.formula}. This is a preview of the contract&apos;s own formula, not a minted balance
                  {s.applicationMode === "DEMO" ? " (DEMO: nothing will be minted)" : ""}; the contract&apos;s result is read back after the transaction.
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-muted">{c.reward.reason}</p>
            )}
            {c.contract.supported ? (
              <p className="mt-2 text-xs text-muted">
                Contract mode: <span className="font-mono text-fg">{c.contract.modeName}</span> ({c.contract.mode})
              </p>
            ) : (
              <p className="mt-2 text-xs text-warn">Not recordable on-chain: {c.contract.reason}</p>
            )}
          </div>

          <details className="group rounded-xl border border-line bg-bg-2/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-fg [&::-webkit-details-marker]:hidden">
              <span className="font-mono text-[11px] tracking-[0.1em] uppercase">How did MissionEV calculate my carbon savings?</span>
              <ChevronDown aria-hidden className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-line px-4 py-4 text-sm">
              <div>
                <p className="section-label">Accounting boundary</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  <span className="text-fg">{BOUNDARY[c.boundary].label}.</span> {BOUNDARY[c.boundary].description}
                </p>
              </div>
              <div>
                <p className="section-label">Your journey</p>
                <p className="mt-1 font-mono text-[11.5px] leading-relaxed [overflow-wrap:anywhere] text-fg">{c.actual.formula}</p>
                {record?.vehicle && <p className="mt-1 text-xs text-muted">Efficiency: {EFFICIENCY_SOURCE_LABEL[record.vehicle.spec.efficiencySource]}.</p>}
              </div>
              <div>
                <p className="section-label">Reference journey · {c.baseline.label}</p>
                <p className="mt-1 font-mono text-[11.5px] leading-relaxed [overflow-wrap:anywhere] text-fg">{c.baseline.formula}</p>
              </div>
              <div>
                <p className="section-label">Avoided emissions</p>
                <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-fg">
                  max(0, ⌊{g(c.baseline.grams, 3)} − {g(c.actual.grams, 3)}⌋) = {c.co2AvoidedGrams} g → sent to the contract as <span className="text-lime">co2AvoidedGrams</span> (uint32), distance {c.distanceMeters} m
                </p>
              </div>
              {s?.preview && c.reward.eligible && (
                <div>
                  <p className="section-label">Reward formula (contract)</p>
                  <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-fg">{s.preview.formula}</p>
                  <p className="mt-1 text-xs text-muted">20 MEV per kg × streak multiplier (1.0× / 1.5× from day 5 / 2× from day 10 / 3× from day 20) + mode bonus (EV and metro 10, walking/cycling 15).</p>
                </div>
              )}
              <div>
                <p className="section-label">Factors &amp; sources · {c.reportingYear}</p>
                <ul className="mt-2 space-y-2">
                  {c.factors.map((f) => (
                    <li key={f.id} className="rounded-lg border border-line p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-fg">{f.label}</span>
                        <span className="flex items-center gap-1.5">
                          <Badge tone={statusTone[f.status]}>{f.status}</Badge>
                          <Badge tone={tone[f.confidence]}>{f.confidence}</Badge>
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-fg">
                        {f.value} {f.unit} · {f.geography} · {f.year}
                      </p>
                      <p className="mt-1 text-muted [overflow-wrap:anywhere]">
                        {f.method}. {f.source}
                        {f.version ? ` · ${f.version}` : ""}.{" "}
                        {f.sourceUrl && (
                          <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
                            source
                          </a>
                        )}
                      </p>
                      {f.notes && <p className="mt-1 text-muted">{f.notes}</p>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="section-label">Assumptions &amp; data confidence</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
                  {c.assumptions.map((a) => (
                    <li key={a} className="[overflow-wrap:anywhere]">
                      {a}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  Overall confidence is the lowest of its inputs: <Badge tone={tone[c.confidence]}>{c.confidence}</Badge>
                </p>
              </div>
              {c.warnings.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-warn">
                  {c.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <p className="text-xs leading-relaxed text-muted">
            $MEV is a <strong className="text-fg">prototype mobility reward token, not a certified carbon credit</strong>. Estimated emissions, avoided emissions, the reward preview, your real on-chain $MEV balance, native tPOT gas and certified credits are five different things.
          </p>
        </div>
      )}
    </Panel>
  );
}
