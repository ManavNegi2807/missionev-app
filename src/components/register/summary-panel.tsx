"use client";

import { ArrowRight, CheckCircle2, Circle, FlaskConical, RotateCcw } from "lucide-react";
import { Alert, Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { MODE_INFO, vehicleLabel } from "@/lib/transport/profile";
import type { RegistrationRecord } from "@/providers/onboarding-provider";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-fg">{children}</dd>
    </div>
  );
}

function Group({ title, tone, status, children }: { title: string; tone: "ok" | "warn" | "neutral"; status: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="section-label">{title}</h3>
        <Badge tone={tone} dot>
          {status}
        </Badge>
      </div>
      <dl className="divide-y divide-line/60">{children}</dl>
    </div>
  );
}

export function SummaryPanel({
  account,
  onContinue,
  onReset,
}: {
  account: RegistrationRecord | null;
  onContinue: () => void;
  onReset: () => void;
}) {
  const t = account?.transport ?? null;

  const checks = [
    { label: "Mobile number verified", done: account !== null },
    { label: "Transport profile saved", done: t !== null },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);

  return (
    <Panel glass aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
      <PanelHeader id="summary-title" eyebrow="Process 1.0" title="Account summary" />

      <div className="divide-y divide-line">
        <Group title="Account" tone={account ? "ok" : "neutral"} status={account ? "Signed in" : "Signed out"}>
          <Row label="Mobile">
            <span className="font-mono">{account?.phone.masked ?? "—"}</span>
          </Row>
          <Row label="User">
            <span className="font-mono">{account?.userId ?? "—"}</span>
          </Row>
        </Group>

        <Group title="Transport profile" tone={t ? "ok" : "warn"} status={t ? "Saved" : "Not set"}>
          <Row label="Modes">{t ? (t.preferredModes.length ? `${t.preferredModes.length} selected` : "None yet") : "—"}</Row>
          <Row label="Vehicles">{t ? (t.registeredVehicles.length ? t.registeredVehicles.map(vehicleLabel).join(", ") : "None") : "—"}</Row>
          {t && t.preferredModes.length > 0 && <Row label="Usual">{t.preferredModes.slice(0, 2).map((m) => MODE_INFO[m].label).join(" · ")}</Row>}
        </Group>

        <div className="px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="section-label">Setup status</h3>
            <span className="font-mono text-xs text-lime">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Account setup progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1.5 overflow-hidden rounded-full bg-line-strong/50"
          >
            <div className="h-full rounded-full bg-lime shadow-[0_0_10px_color-mix(in_srgb,var(--color-lime)_45%,transparent)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {checks.map((c) => (
              <li key={c.label} className={cn("flex items-center gap-2 text-sm", c.done ? "text-fg" : "text-muted")}>
                {c.done ? <CheckCircle2 aria-hidden className="size-4 text-ok" /> : <Circle aria-hidden className="size-4 text-line-strong" />}
                {c.label}
                <span className="sr-only">{c.done ? "complete" : "incomplete"}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3 border-t border-line p-4 sm:p-6">
        {account && (
          <div className="flex items-center gap-2 rounded-lg border border-warn/35 bg-warn/[0.07] px-3 py-2">
            <FlaskConical aria-hidden className="size-4 shrink-0 text-warn" />
            <p className="font-mono text-[11px] tracking-[0.12em] text-warn">DEMO DATA — OTP IS SIMULATED</p>
          </div>
        )}

        {account ? (
          <>
            {!t && (
              <Alert role="status" tone="cyan" title="Profile not saved yet">
                You can continue now: metro, bus, walking and ride-hail journeys need no vehicle. Save a profile on the left to log journeys in your own car or bike.
              </Alert>
            )}
            <Button variant="primary" size="lg" className="w-full" onClick={onContinue} icon={<ArrowRight aria-hidden className="size-4" />}>
              Continue to capture trip
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={onReset} icon={<RotateCcw aria-hidden className="size-3.5" />}>
              Sign out &amp; reset
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="lg" className="w-full" disabled aria-describedby="signin-blocked" icon={<ArrowRight aria-hidden className="size-4" />}>
              Continue to capture trip
            </Button>
            <p id="signin-blocked" className="text-center text-xs text-muted">
              Sign in with your mobile number to continue.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
