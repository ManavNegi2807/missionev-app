"use client";

import { ArrowRight, CheckCircle2, Circle, FlaskConical, RotateCcw } from "lucide-react";
import { Alert, Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, shortAddress } from "@/lib/format";
import type { RegistrationRecord } from "@/providers/onboarding-provider";
import { useWallet } from "@/providers/wallet-provider";
import { PORTAL_V3 } from "@/lib/chain";

export interface VehicleSummary {
  maskedReg: string;
  title: string;
  verified: boolean;
}

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
  vehicle,
  formValid,
  registration,
  registering,
  justRegistered,
  blockedReason,
  onRegister,
  onContinue,
  onReset,
}: {
  vehicle: VehicleSummary | null;
  formValid: boolean;
  registration: RegistrationRecord | null;
  registering: boolean;
  justRegistered: boolean;
  blockedReason: string | null;
  onRegister: () => void;
  onContinue: () => void;
  onReset: () => void;
}) {
  const w = useWallet();
  const registered = registration !== null;

  const checks = [
    { label: "Wallet connected", done: w.isConnected },
    { label: `${PORTAL_V3.shortName} network`, done: w.isConnected && (w.isDemo || w.onExpectedChain) },
    { label: "Vehicle details valid", done: formValid || Boolean(vehicle?.verified) },
    { label: "Vehicle verified (demo registry)", done: Boolean(vehicle?.verified) },
    { label: "Profile registered", done: registered },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checks.length) * 100);

  const walletTone = !w.isConnected ? "neutral" : w.isDemo || !w.onExpectedChain ? "warn" : "ok";
  const walletStatus = !w.isConnected ? "Disconnected" : w.isDemo ? "Demo" : w.onExpectedChain ? "Connected" : "Wrong network";
  const isDemoData = w.isDemo || Boolean(vehicle?.verified) || Boolean(registration?.isDemoData);

  return (
    <Panel glass aria-labelledby="summary-title" className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
      <PanelHeader id="summary-title" eyebrow="Process 1.0" title="Registration summary" />

      <div className="divide-y divide-line">
        <Group title="Wallet identity" tone={walletTone} status={walletStatus}>
          <Row label="Address">
            <span className="font-mono">{w.isConnected ? shortAddress(w.address) : "—"}</span>
          </Row>
          <Row label="Network">{w.isConnected ? w.networkName : "—"}</Row>
        </Group>

        <Group title="Vehicle identity" tone={vehicle?.verified ? "ok" : "warn"} status={vehicle?.verified ? "Verified" : "Pending"}>
          <Row label="Registration">
            <span className="font-mono">{vehicle?.maskedReg ?? "—"}</span>
          </Row>
          <Row label="Vehicle">{vehicle?.title ?? "—"}</Row>
        </Group>

        <div className="px-4 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="section-label">Registration status</h3>
            <span className="font-mono text-xs text-lime">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Profile registration progress"
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
        {isDemoData && (
          <div className="flex items-center gap-2 rounded-lg border border-warn/35 bg-warn/[0.07] px-3 py-2">
            <FlaskConical aria-hidden className="size-4 shrink-0 text-warn" />
            <p className="font-mono text-[11px] tracking-[0.12em] text-warn">DEMO DATA — NOT A LIVE REGISTRATION</p>
          </div>
        )}

        {registered ? (
          <>
            <Alert
              role="status"
              tone="ok"
              icon={<CheckCircle2 aria-hidden className="size-4" />}
              title={justRegistered ? "Registration complete" : "Already registered"}
            >
              Saved to D1 · Users &amp; Vehicles (this browser tab only). User{" "}
              <span className="font-mono text-fg">{registration.userId}</span>.
              {justRegistered && " Continuing to Capture Trip…"}
            </Alert>
            <Button variant="primary" size="lg" className="w-full" onClick={onContinue} icon={<ArrowRight aria-hidden className="size-4" />}>
              Continue to capture trip
            </Button>
            <Button variant="ghost" size="sm" className="w-full" onClick={onReset} icon={<RotateCcw aria-hidden className="size-3.5" />}>
              Clear &amp; re-register
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={registering}
              disabled={Boolean(blockedReason)}
              onClick={onRegister}
              aria-describedby={blockedReason ? "register-blocked" : undefined}
              icon={<ArrowRight aria-hidden className="size-4" />}
            >
              {registering ? "Registering…" : "Register & continue"}
            </Button>
            {blockedReason && (
              <p id="register-blocked" className="text-center text-xs text-muted">
                {blockedReason}
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
