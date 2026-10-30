"use client";

import { Info, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Alert, Badge, Panel } from "@/components/ui/primitives";
import { cn, formatClock } from "@/lib/format";
import { EMISSION_CONFIG } from "@/lib/trip/emissions";
import type { ContractTier } from "@/lib/trip/types";
import { useTrip } from "@/providers/trip-provider";

const TIERS: ContractTier[] = ["Gold", "Silver", "Bronze", "Rejected"];

export function TrustPanel() {
  const { status, verify, record } = useTrip();
  const trust = record?.verification?.trust ?? verify.trust;
  const assigning = status === "VERIFYING" && verify.running === "3.5";
  const failed = status === "FAILED" || (trust && !trust.assigned);

  return (
    <Panel aria-labelledby="trust-title" className={cn(trust?.assigned && "border-lime/30", failed && "border-err/40")}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div>
          <p className="section-label mb-1">3.5 / Assign trust level</p>
          <h2 id="trust-title" className="text-[15px] font-semibold tracking-[0.06em] uppercase">
            Trust assignment
          </h2>
        </div>
        {trust?.isDemo && <Badge tone="warn">Demo</Badge>}
      </header>

      <div className="space-y-5 p-4 sm:p-6">
        {!trust && !assigning && (
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-line-strong p-5 text-muted">
            <ShieldQuestion aria-hidden className="size-9 shrink-0" />
            <div>
              <p className="text-sm font-medium text-fg">No trust level assigned yet</p>
              <p className="mt-1 text-sm">Complete a trip and run verification. Trust is assigned only after all applicable checks have run.</p>
            </div>
          </div>
        )}

        {assigning && (
          <div role="status" className="flex items-center gap-4 rounded-xl border border-cyan/30 bg-cyan/[0.04] p-5">
            <Loader2 aria-hidden className="size-8 shrink-0 animate-spin text-cyan" />
            <p className="font-mono text-sm tracking-wider text-cyan">EVALUATING CONFIGURED RULES…</p>
          </div>
        )}

        {trust?.assigned && (
          <div role="status" className="flex flex-col gap-4 rounded-xl border border-lime/30 bg-lime/[0.05] p-5 sm:flex-row sm:items-center">
            <ShieldCheck aria-hidden className="size-12 shrink-0 text-lime" />
            <div className="min-w-0">
              <p className="font-mono text-[11px] tracking-[0.2em] text-muted">ASSIGNED{trust.isDemo ? " · DEMO" : ""}</p>
              <p className="mt-1 font-mono text-3xl font-semibold tracking-wide text-lime sm:text-4xl">TRUST LEVEL 4.0</p>
              <p className="mt-1 font-mono text-[11px] tracking-wider text-muted">GENERATED {formatClock(trust.at)}</p>
            </div>
          </div>
        )}

        {trust && !trust.assigned && (
          <Alert role="alert" tone="err" icon={<ShieldAlert aria-hidden className="size-5" />} title="Not verified — trust level not assigned">
            <p>A critical condition failed, so this trip cannot be presented as verified and cannot be recorded.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-fg">
              {trust.failedConditions.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="flex gap-3 rounded-xl border border-line bg-bg-2/50 p-3.5 text-sm leading-relaxed text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-cyan" />
          <p>
            <span className="text-fg">4.0</span> is the trust-level <em>stage</em> defined by the MissionEV workflow — reached when every
            applicable check passes under the configured rules. It is not an independently certified score.
            {trust?.isDemo && " Because at least one check used a mock or simulated source, this result is DEMO."}
          </p>
        </div>

        <div>
          <p className="section-label mb-2">Contract trust tier (MissionEVRewards · reward multiplier)</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIERS.map((t) => {
              const on = trust ? trust.tier === t : false;
              return (
                <li
                  key={t}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-center font-mono text-xs",
                    on ? (t === "Rejected" ? "border-err/50 bg-err/[0.08] text-err" : "border-lime/50 bg-lime/[0.08] text-lime") : "border-line text-muted",
                  )}
                  aria-current={on ? "true" : undefined}
                >
                  {t.toUpperCase()}
                  <span className="block text-[11px]">{EMISSION_CONFIG.trustPercent[t]}%</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Gold: all checks incl. partner proof · Silver: no partner ride-log · Rejected: any critical failure (from the project’s decision table).
          </p>
        </div>
      </div>
    </Panel>
  );
}
