"use client";

import type { ReactNode } from "react";
import { Activity, BadgeCheck, Car, Clock, Gauge, Leaf, Navigation, Satellite } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn, formatDuration } from "@/lib/format";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useTrip, type GpsSignal } from "@/providers/trip-provider";

function Kpi({
  label,
  icon,
  unit,
  children,
  sub,
  tone = "fg",
}: {
  label: string;
  icon: ReactNode;
  unit?: string;
  children: ReactNode;
  sub?: ReactNode;
  tone?: "fg" | "lime" | "cyan" | "warn" | "ok" | "err" | "muted";
}) {
  const color = { fg: "text-fg", lime: "text-lime", cyan: "text-cyan", warn: "text-warn", ok: "text-ok", err: "text-err", muted: "text-muted" }[tone];
  return (
    <div data-kpi={label} className="min-w-0 rounded-xl border border-line bg-panel p-3 shadow-panel sm:p-4">
      <div className="flex items-center gap-2 text-muted">
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
        <p className="section-label truncate">{label}</p>
      </div>
      <p className={cn("mt-2 flex items-baseline gap-1.5 font-mono text-xl leading-none font-semibold sm:text-2xl", color)}>
        <span className="min-w-0 truncate">{children}</span>
        {unit && <span className="shrink-0 text-[11px] font-normal tracking-wider text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-2 truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

const SIGNAL: Record<GpsSignal, { text: string; tone: "muted" | "ok" | "cyan" | "warn" | "err" }> = {
  idle: { text: "NOT STARTED", tone: "muted" },
  requesting: { text: "AWAITING PERMISSION", tone: "cyan" },
  strong: { text: "STRONG", tone: "ok" },
  good: { text: "GOOD", tone: "ok" },
  weak: { text: "WEAK", tone: "warn" },
  poor: { text: "POOR", tone: "err" },
  denied: { text: "DENIED", tone: "err" },
  unavailable: { text: "UNAVAILABLE", tone: "err" },
  simulated: { text: "SIMULATED", tone: "warn" },
};

export function KpiGrid() {
  const { status, live, record, gps, verify, setup } = useTrip();
  const { registration } = useOnboarding();

  const frozen = record;
  const simulated = (frozen?.source ?? setup.source) === "simulated";
  const distanceKm = frozen?.distanceKm ?? live.distanceKm;
  const durationSec = frozen?.durationSec ?? (simulated ? live.simSec : live.activeMs / 1000);
  const avg = frozen?.avgSpeedKmh ?? (durationSec > 0 ? distanceKm / (durationSec / 3600) : 0);
  const sig = SIGNAL[gps.signal];
  const trust = verify.trust ?? frozen?.verification?.trust ?? null;
  const emissions = frozen?.emissions ?? null;
  const v = registration?.vehicle;

  return (
    <section aria-label="Live telemetry" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kpi label="Distance travelled" unit="km" icon={<Navigation className="size-4" />} tone="lime" sub={simulated ? "from simulated samples" : "haversine over GPS samples"}>
        <AnimatedNumber value={distanceKm} decimals={2} />
      </Kpi>
      <Kpi label="Trip duration" unit="min:sec" icon={<Clock className="size-4" />} sub={simulated ? "simulated clock (×40 speed-up)" : "active recording time"}>
        {formatDuration(durationSec)}
      </Kpi>
      <Kpi label="Average speed" unit="km/h" icon={<Gauge className="size-4" />} sub={status === "RECORDING" ? `now ${live.currentSpeedKmh.toFixed(0)} km/h` : "distance ÷ duration"}>
        <AnimatedNumber value={avg} decimals={1} />
      </Kpi>
      <Kpi
        label="GPS signal"
        icon={<Satellite className="size-4" />}
        tone={sig.tone}
        sub={gps.signal === "simulated" ? "no GPS read — simulated" : live.lastAccuracy != null ? `accuracy ±${Math.round(live.lastAccuracy)} m` : "browser geolocation"}
      >
        <span className="text-base sm:text-lg">{sig.text}</span>
      </Kpi>
      <Kpi label="Transport mode" icon={<Activity className="size-4" />} sub="declared from registration">
        <span className="text-base sm:text-lg">{v ? v.category : "—"}</span>
      </Kpi>
      <Kpi label="Vehicle ID" icon={<Car className="size-4" />} sub={v ? `${v.manufacturer} ${v.model} · ${v.fuel}` : undefined}>
        <span className="text-base sm:text-lg">{v?.maskedReg ?? "—"}</span>
      </Kpi>
      <Kpi
        label="Trust level"
        icon={<BadgeCheck className="size-4" />}
        tone={trust ? (trust.assigned ? "lime" : "err") : "muted"}
        sub={trust ? (trust.assigned ? `stage 4.0 · ${trust.tier} tier${trust.isDemo ? " · DEMO" : ""}` : "not verified") : "assigned after verification"}
      >
        {trust ? (trust.assigned ? "4.0" : <span className="text-base sm:text-lg">NOT VERIFIED</span>) : "—"}
      </Kpi>
      <Kpi
        label="Est. emissions"
        unit={emissions ? "g CO₂e" : undefined}
        icon={<Leaf className="size-4" />}
        tone={emissions ? "cyan" : "muted"}
        sub={emissions ? (emissions.isDemo ? "illustrative · DEMO" : "illustrative") : "calculated after verification"}
      >
        {emissions ? <AnimatedNumber value={emissions.estimatedG} decimals={1} /> : "—"}
      </Kpi>
    </section>
  );
}
