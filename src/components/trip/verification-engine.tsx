"use client";

import { useId, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, FlaskConical, Loader2, MinusCircle, XCircle } from "lucide-react";
import { Badge, Panel } from "@/components/ui/primitives";
import { CONFIGURED_BASEMAP } from "@/lib/maps/provider";
import { cn, formatClock } from "@/lib/format";
import type { CheckId, CheckResult } from "@/lib/trip/types";
import { useTrip } from "@/providers/trip-provider";

const META: Record<CheckId, { title: string; source: string; sourceNote: string; blurb: string }> = {
  "3.1": {
    title: "Vehicle profile check",
    source: "Your vehicle profile",
    sourceNote: "Self-declared on Screen 01 · no registry is contacted",
    blurb: "Vehicle type, fuel and mileage match your profile. Skipped for metro, bus and walking.",
  },
  "3.2": {
    title: "EV maker ride-log check",
    source: "EV manufacturer API",
    sourceNote: "Not integrated · deterministic mock",
    blurb: "Ride-log availability, identity consistency, reported distance.",
  },
  "3.3": {
    title: "Motion & GPS validation",
    source: "D2 Trips & Telemetry",
    sourceNote: "Local rules over frontend state",
    blurb: "Sample completeness, movement, distance plausibility, replay.",
  },
  "3.4": {
    title: "Route validation",
    source: "Route geometry",
    sourceNote: "Local geometry · no routing API integrated",
    blurb: "Route consistency, start/end coordinates, distance, anomalies.",
  },
};

function statusView(c: CheckResult, running: boolean) {
  if (running) return { label: "RUNNING", tone: "cyan" as const, icon: <Loader2 aria-hidden className="size-5 animate-spin text-cyan" /> };
  switch (c.status) {
    case "pass":
      return { label: "PASS", tone: "ok" as const, icon: <CheckCircle2 aria-hidden className="size-5 text-ok" /> };
    case "demo":
      return { label: "DEMO", tone: "warn" as const, icon: <FlaskConical aria-hidden className="size-5 text-warn" /> };
    case "fail":
      return { label: c.isDemo ? "FAIL · DEMO" : "FAIL", tone: "err" as const, icon: <XCircle aria-hidden className="size-5 text-err" /> };
    case "na":
      return { label: "NOT APPLICABLE", tone: "neutral" as const, icon: <MinusCircle aria-hidden className="size-5 text-muted" /> };
    default:
      return { label: "PENDING", tone: "neutral" as const, icon: <CircleDashed aria-hidden className="size-5 text-muted" /> };
  }
}

function CheckCard({ c, running }: { c: CheckResult; running: boolean }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const m = META[c.id];
  const v = statusView(c, running);
  const ran = c.status !== "pending";
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-bg-2/50",
        c.status === "fail" ? "border-err/40" : running ? "border-cyan/40 shadow-glow-cyan" : c.status === "pass" || c.status === "demo" ? "border-line-strong" : "border-line",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 shrink-0">{v.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] tracking-[0.16em] text-lime">CHECK {c.id}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-fg">{m.title}</h3>
          <p className="mt-1 truncate text-xs text-muted" title={`${m.source} — ${m.sourceNote}`}>
            <span className="text-fg/80">SOURCE:</span> {m.source}
          </p>
          <p className="truncate text-[11px] text-muted/80">{m.sourceNote}</p>
        </div>
        <Badge tone={v.tone}>{v.label}</Badge>
      </div>

      <p className="px-4 text-sm leading-relaxed text-muted">{ran ? c.summary : m.blurb}</p>

      {ran && c.items.length > 0 && (
        <ul className="mt-3 space-y-1.5 px-4">
          {c.items.map((it) => (
            <li key={it.label} className="flex items-start gap-2 text-[13px]">
              <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", it.ok === true ? "bg-ok" : it.ok === false ? "bg-err" : "bg-muted")} />
              <span className={cn("min-w-0", it.ok === false ? "text-err" : "text-fg")}>
                {it.label}
                <span className="sr-only">{it.ok === true ? ": ok" : it.ok === false ? ": failed" : ": not evaluated"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 px-4 pt-3 pb-3">
        <p className="font-mono text-[10.5px] tracking-wider text-muted">{c.at ? `GENERATED ${formatClock(c.at)}` : ran ? "" : "NOT RUN YET"}</p>
        {ran && c.items.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={regionId}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase hover:text-cyan"
          >
            {open ? "Hide details" : "Inspect"}
            <ChevronDown aria-hidden className={cn("size-3.5 transition", open && "rotate-180")} />
          </button>
        )}
      </div>

      {open && (
        <div id={regionId} className="space-y-3 border-t border-line px-4 py-3">
          <ul className="space-y-2">
            {c.items.map((it) => (
              <li key={it.label} className="text-xs">
                <span className="text-fg">{it.label}</span>
                <span className="block break-words text-muted">{it.detail}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            {Object.entries(c.technical).map(([k, val]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="min-w-0 break-all text-fg">{String(val)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </li>
  );
}

export function VerificationEngine() {
  const { status, verify, record } = useTrip();
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const checks = status === "VERIFIED" || status === "FAILED" ? (record?.verification?.checks ?? verify.checks) : verify.checks;
  const verifying = status === "VERIFYING";
  const pct = Math.round((verify.step / 5) * 100);
  const started = verifying || status === "VERIFIED" || status === "FAILED";

  return (
    <Panel aria-labelledby="engine-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="section-label mb-1">Process 3.0 · Verify trip</p>
          <h2 id="engine-title" className="text-[15px] font-semibold tracking-[0.06em] uppercase">
            Trip authenticity engine
          </h2>
          <p className="mt-1 text-sm text-muted">Four independent checks evaluate the submitted mobility record.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 font-mono text-[11px] tracking-[0.1em] text-muted uppercase hover:border-line-strong hover:text-fg"
        >
          {open ? "Collapse" : "Expand"}
          <ChevronDown aria-hidden className={cn("size-4 transition", open && "rotate-180")} />
        </button>
      </header>

      {open && (
        <div id={bodyId} className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap gap-2" aria-label="Integration status">
            <Badge dot>Vehicle profile · self-declared</Badge>
            <Badge dot>EV maker API · not connected</Badge>
            <Badge dot>D2 · local state</Badge>
            <Badge tone="cyan" dot>
              Map · {CONFIGURED_BASEMAP} basemap, routing not integrated
            </Badge>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between font-mono text-[10.5px] tracking-[0.12em] text-muted">
              <span>{verifying ? (verify.running === "3.5" ? "ASSIGNING TRUST LEVEL (3.5)…" : `RUNNING CHECK ${verify.running}…`) : started ? "SEQUENCE COMPLETE" : "WAITING FOR A COMPLETED TRIP"}</span>
              <span className="text-lime">{started ? `${pct}%` : "—"}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Verification sequence progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={started ? pct : 0}
              className="h-1.5 overflow-hidden rounded-full bg-line-strong/50"
            >
              <div className="h-full rounded-full bg-lime shadow-[0_0_10px_color-mix(in_srgb,var(--color-lime)_45%,transparent)] transition-[width] duration-700" style={{ width: `${started ? pct : 0}%` }} />
            </div>
          </div>

          <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {(["3.1", "3.2", "3.3", "3.4"] as CheckId[]).map((id) => (
              <CheckCard key={id} c={checks[id]} running={verifying && verify.running === id} />
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}
