"use client";

import { AlertTriangle, FlaskConical, MapPin, Satellite } from "lucide-react";
import { SelectField } from "@/components/ui/fields";
import { Alert, Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { DEMO_ROUTES } from "@/lib/trip/demo-routes";
import type { Scenario, TripSource, TripStatus } from "@/lib/trip/types";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useTrip } from "@/providers/trip-provider";

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
  { id: "ridelog-mismatch", label: "EV ride-log mismatch", note: "EV only → check 3.2 fails." },
];

export function SessionPanel() {
  const { status, setup, setSetup, notice, dismissNotice, start, gps } = useTrip();
  const { registration } = useOnboarding();
  const idle = status === "IDLE";
  const isEv = registration?.vehicle.fuel === "Electric";
  const currentIdx = status === "VERIFIED" || status === "FAILED" ? 5 : STATES.findIndex((s) => s.id === status);

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
          <p className="section-label">Data source</p>
          <div role="radiogroup" aria-label="Data source" className="flex gap-2">
            {seg("gps", "Real GPS", <Satellite aria-hidden className="size-4" />)}
            {seg("simulated", "Simulated", <FlaskConical aria-hidden className="size-4" />)}
          </div>
          <p className="text-xs leading-relaxed text-muted">
            {setup.source === "gps"
              ? "Location is requested only after you press START TRIP and approve the browser prompt."
              : "Simulated mode moves a demo vehicle along an illustrative Delhi route. It never reads GPS and everything it produces is labelled DEMO."}
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
            title={notice.tone === "cyan" ? "Notice" : "GPS unavailable"}
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
