"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bike, Bus, Car, CarTaxiFront, FlaskConical, Footprints, MapPin, Satellite, TrainFront, Zap } from "lucide-react";
import { SelectField } from "@/components/ui/fields";
import { Alert, Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import type { JourneyMode } from "@/lib/carbon/types";
import { cn } from "@/lib/format";
import { DEMO_ROUTES } from "@/lib/trip/demo-routes";
import { TRAVEL_LABEL, isPrivateMode } from "@/lib/trip/travel";
import type { Scenario, TripSource, TripStatus } from "@/lib/trip/types";
import { vehicleLabel, vehiclesForJourney, type RegisteredVehicle } from "@/lib/transport/profile";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useTrip } from "@/providers/trip-provider";
import { RideHailSection } from "./ride-hail-section";

const STATES: Array<{ id: TripStatus | "RESULT"; label: string }> = [
  { id: "IDLE", label: "Idle" },
  { id: "RECORDING", label: "Recording" },
  { id: "PAUSED", label: "Paused" },
  { id: "COMPLETED", label: "Completed" },
  { id: "VERIFYING", label: "Verifying" },
  { id: "RESULT", label: "Verified / Failed" },
];

const SCENARIOS: Array<{ id: Scenario; label: string; note: string }> = [
  { id: "clean", label: "Clean trip", note: "All checks should pass." },
  { id: "gps-replay", label: "Replay anomaly", note: "Clock stalls mid-trip → check 3.3 fails." },
  { id: "route-mismatch", label: "Route deviation", note: "Vehicle leaves the route → check 3.4 fails." },
  { id: "ridelog-mismatch", label: "EV ride-log mismatch", note: "Private EV only → check 3.2 fails." },
];

/** The eight ways to answer "How did you travel for this journey?". Private tiles then pick one of your saved vehicles. */
const TILES: Array<{ id: string; label: string; icon: React.ReactNode; modes: JourneyMode[] }> = [
  { id: "ev", label: "Private EV", icon: <Zap aria-hidden className="size-4" />, modes: ["private_ev_car", "private_ev_2w"] },
  { id: "petrol", label: "Petrol car", icon: <Car aria-hidden className="size-4" />, modes: ["private_petrol_car"] },
  { id: "diesel", label: "Diesel car", icon: <Car aria-hidden className="size-4" />, modes: ["private_diesel_car"] },
  { id: "two_wheeler", label: "Two-wheeler", icon: <Bike aria-hidden className="size-4" />, modes: ["private_ev_2w", "private_ice_2w"] },
  { id: "ride_hail", label: "Ola / Uber / Rapido", icon: <CarTaxiFront aria-hidden className="size-4" />, modes: ["ride_hail"] },
  { id: "metro", label: "Metro", icon: <TrainFront aria-hidden className="size-4" />, modes: ["metro"] },
  { id: "ebus", label: "Electric bus", icon: <Bus aria-hidden className="size-4" />, modes: ["ebus"] },
  { id: "active", label: "Walking / cycling", icon: <Footprints aria-hidden className="size-4" />, modes: ["active"] },
];

export function SessionPanel() {
  const { status, setup, setSetup, selection, notice, dismissNotice, start, gps } = useTrip();
  const { registration } = useOnboarding();
  const idle = status === "IDLE";
  const transport = registration?.transport ?? null;
  const [tileId, setTileId] = useState<string>(() => TILES.find((t) => t.modes.includes(setup.mode))?.id ?? "metro");
  const tile = TILES.find((t) => t.id === tileId) ?? TILES[0];

  const savedFor = (modes: JourneyMode[]): RegisteredVehicle[] => modes.flatMap((m) => vehiclesForJourney(transport, m));
  const candidates = savedFor(tile.modes);
  const isEv = setup.mode === "private_ev_car" || setup.mode === "private_ev_2w";
  const currentIdx = status === "VERIFIED" || status === "FAILED" ? 5 : STATES.findIndex((s) => s.id === status);

  const pickTile = (id: string) => {
    const t = TILES.find((x) => x.id === id)!;
    setTileId(id);
    const first = savedFor(t.modes)[0];
    const mode = first ? (first.mode as JourneyMode) : t.modes[0];
    // The ride-log scenario only exists for a private EV, so drop it when leaving that kind of journey.
    setSetup({ mode, vehicleId: first?.id ?? null, ...(mode !== "private_ev_car" && mode !== "private_ev_2w" && setup.scenario === "ridelog-mismatch" ? { scenario: "clean" as const } : {}) });
  };

  const seg = (id: TripSource, label: string, icon: React.ReactNode) => {
    const on = setup.source === id;
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={on}
        disabled={!idle}
        onClick={() => setSetup({ source: id })}
        className={cn(
          "flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border font-mono text-[11px] tracking-[0.1em] uppercase transition disabled:cursor-not-allowed disabled:opacity-60",
          on ? "border-lime/50 bg-lime/[0.1] text-lime" : "border-line bg-bg-2 text-muted hover:text-fg",
        )}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <Panel aria-labelledby="session-title">
      <PanelHeader
        id="session-title"
        eyebrow="Journey state machine"
        title="Trip session"
        action={
          <Badge tone={status === "FAILED" ? "err" : status === "VERIFIED" ? "ok" : status === "RECORDING" ? "lime" : "neutral"} dot>
            {status}
          </Badge>
        }
      />
      <div className="space-y-5 p-4 sm:p-6">
        <ol aria-label="Journey states" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {STATES.map((s, i) => {
            const on = i === currentIdx;
            const past = i < currentIdx;
            const resultTone = i === 5 && status === "FAILED" ? "border-err/50 text-err bg-err/[0.08]" : "border-lime/50 text-lime bg-lime/[0.08]";
            return (
              <li
                key={s.id}
                aria-current={on ? "step" : undefined}
                className={cn(
                  "truncate rounded-md border px-2 py-1.5 text-center font-mono text-[11px] tracking-[0.1em] uppercase",
                  on ? resultTone : past ? "border-line-strong text-fg" : "border-line text-muted/70",
                )}
              >
                {i === 5 && status === "FAILED" ? "Failed" : i === 5 && status === "VERIFIED" ? "Verified" : s.label}
              </li>
            );
          })}
        </ol>

        <div className="space-y-3">
          <p id="journey-question" className="section-label">How did you travel for this journey?</p>
          <div role="radiogroup" aria-labelledby="journey-question" className="grid grid-cols-2 gap-2">
            {TILES.map((t) => {
              const on = t.id === tileId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!idle}
                  onClick={() => pickTile(t.id)}
                  className={cn(
                    "flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 font-mono text-[11px] tracking-[0.08em] uppercase transition disabled:cursor-not-allowed disabled:opacity-50",
                    on ? "border-lime/50 bg-lime/[0.1] text-lime" : "border-line bg-bg-2 text-muted hover:text-fg",
                  )}
                >
                  {t.icon}
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted">
            This journey is calculated as <span className="text-fg">{TRAVEL_LABEL[setup.mode]}</span>. Your saved vehicles don&apos;t decide it: what you actually travelled in does.
          </p>

          {tile.modes.some(isPrivateMode) &&
            (candidates.length > 0 ? (
              <SelectField
                label="Which vehicle?"
                placeholder="Choose a saved vehicle"
                options={candidates.map((v) => `${vehicleLabel(v)} · ${v.mode.replace("private_", "").replace(/_/g, " ")}`)}
                value={(() => {
                  const cur = candidates.find((v) => v.id === (setup.vehicleId ?? candidates[0].id)) ?? candidates[0];
                  return `${vehicleLabel(cur)} · ${cur.mode.replace("private_", "").replace(/_/g, " ")}`;
                })()}
                disabled={!idle}
                hint="From your transport profile on Screen 01."
                onChange={(e) => {
                  const v = candidates.find((c) => `${vehicleLabel(c)} · ${c.mode.replace("private_", "").replace(/_/g, " ")}` === e.target.value);
                  if (v) setSetup({ mode: v.mode, vehicleId: v.id });
                }}
              />
            ) : (
              <Alert tone="neutral" title="No matching vehicle saved">
                You haven&apos;t saved a {tile.label.toLowerCase()} in your transport profile, so this kind of journey can&apos;t be calculated yet.{" "}
                <Link href="/register" className="text-cyan hover:underline">
                  Add one
                </Link>{" "}
                — or pick how you actually travelled. No vehicle is needed for metro, bus, walking or a cab.
              </Alert>
            ))}

          {setup.mode === "ride_hail" && <RideHailSection disabled={!idle} />}
        </div>

        <div className="space-y-3">
          <p className="section-label">Data source</p>
          <div role="radiogroup" aria-label="Data source" className="flex gap-2">
            {seg("gps", "Real GPS", <Satellite aria-hidden className="size-4" />)}
            {seg("simulated", "Simulated", <FlaskConical aria-hidden className="size-4" />)}
          </div>
          <p className="text-xs leading-relaxed text-muted">
            {setup.source === "gps"
              ? "Location is requested only after you press START TRIP and approve the browser prompt."
              : "Simulated mode moves a demo vehicle along an illustrative Delhi route. It never reads GPS, everything it produces is labelled DEMO, and it is never signed for the chain."}
          </p>

          {setup.source === "simulated" && (
            <div className="grid gap-4">
              <SelectField
                label="Demo route"
                placeholder="Select route"
                options={DEMO_ROUTES.map((r) => r.name)}
                value={DEMO_ROUTES.find((r) => r.id === setup.routeId)?.name ?? ""}
                disabled={!idle}
                onChange={(e) => {
                  const r = DEMO_ROUTES.find((x) => x.name === e.target.value);
                  if (r) setSetup({ routeId: r.id });
                }}
              />
              <SelectField
                label="Demo scenario"
                placeholder="Select scenario"
                options={SCENARIOS.filter((s) => s.id !== "ridelog-mismatch" || isEv).map((s) => s.label)}
                value={SCENARIOS.find((s) => s.id === setup.scenario)?.label ?? ""}
                disabled={!idle}
                hint={SCENARIOS.find((s) => s.id === setup.scenario)?.note}
                onChange={(e) => {
                  const s = SCENARIOS.find((x) => x.label === e.target.value);
                  if (s) setSetup({ scenario: s.id });
                }}
              />
            </div>
          )}
        </div>

        {idle && selection.blocked && setup.mode !== "ride_hail" && (
          <p role="status" className="text-xs leading-relaxed text-warn">
            {selection.blocked}
          </p>
        )}

        {gps.signal === "requesting" && (
          <Alert role="status" tone="cyan" icon={<MapPin aria-hidden className="size-4" />} title="Waiting for permission">
            {gps.message}
          </Alert>
        )}

        {notice && (
          <Alert
            role="alert"
            tone={notice.tone}
            icon={<AlertTriangle aria-hidden className="size-4" />}
            title={notice.tone === "cyan" ? "Notice" : notice.offerSimulation ? "GPS unavailable" : "Can't start yet"}
            actions={
              <>
                {notice.offerSimulation && (
                  <Button size="sm" variant="primary" icon={<FlaskConical aria-hidden className="size-3.5" />} onClick={() => void start({ source: "simulated" })}>
                    Run simulated trip
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={dismissNotice}>
                  Dismiss
                </Button>
              </>
            }
          >
            {notice.text}
          </Alert>
        )}
      </div>
    </Panel>
  );
}
