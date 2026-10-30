"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Alert } from "@/components/ui/primitives";
import { useOnboarding } from "@/providers/onboarding-provider";
import { ControlsBar } from "./controls-bar";
import { EmissionsCard } from "./emissions-card";
import { KpiGrid } from "./kpi-grid";
import { LedgerPanel } from "./ledger-panel";
import { MapPanel } from "./map-panel";
import { SessionPanel } from "./session-panel";
import { TripDataFlow } from "./trip-data-flow";
import { TripHistory } from "./trip-history";
import { TripPipeline } from "./trip-pipeline";
import { TripSummary } from "./trip-summary";
import { TrustPanel } from "./trust-panel";
import { VerificationEngine } from "./verification-engine";

export function TripScreen() {
  const { ready, isRegistered } = useOnboarding();

  return (
    <div className="space-y-6">
      <section aria-labelledby="trip-title" className="space-y-4">
        <p className="font-mono text-[11px] tracking-[0.2em] text-lime sm:text-xs">02 / MOBILITY TELEMETRY</p>
        <h1 id="trip-title" className="max-w-3xl text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Every journey. Measured.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
          Capture mobility activity, validate its authenticity, estimate its carbon impact, and prepare a verifiable reward event.
        </p>
      </section>

      <TripPipeline />

      {ready && !isRegistered ? (
        <Alert
          role="alert"
          tone="warn"
          icon={<Lock aria-hidden className="size-4" />}
          title="Registration required"
          actions={
            <Link
              href="/register"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-lime px-3 font-mono text-xs tracking-[0.1em] text-bg uppercase hover:shadow-glow-lime"
            >
              <ArrowLeft aria-hidden className="size-3.5" /> Go to Sign-in &amp; Register
            </Link>
          }
        >
          Trips are tied to your wallet and verified vehicle. Complete Screen 01 first (demo mode works).
        </Alert>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI row sits above the map on desktop, below it on mobile (map first). */}
          <div className="order-2 lg:order-1">
            <KpiGrid />
          </div>

          <div className="order-1 grid grid-cols-1 items-start gap-6 lg:order-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <MapPanel />
              <ControlsBar />
            </div>
            <div className="min-w-0 space-y-6">
              <SessionPanel />
              <TripSummary />
            </div>
          </div>

          <div className="order-3 space-y-6">
            <VerificationEngine />
            <TrustPanel />
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
              <EmissionsCard />
              <LedgerPanel />
            </div>
            <TripDataFlow />
            <TripHistory />
          </div>
        </div>
      )}
    </div>
  );
}
