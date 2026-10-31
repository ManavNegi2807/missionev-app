"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Alert, Badge, KV, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatTimestamp, shortAddress } from "@/lib/format";
import { useOnboarding } from "@/providers/onboarding-provider";

/**
 * Stand-in for screens 02–04. It proves the shared shell and the D1 registration
 * state carry across routes; each real screen replaces the body of its page.
 */
export function UpcomingScreen({ step, title, blurb }: { step: string; title: string; blurb: string }) {
  const { registration, ready } = useOnboarding();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="font-mono text-xs tracking-[0.2em] text-lime">{step} / UPCOMING SCREEN</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="max-w-2xl text-muted">{blurb}</p>
      </div>

      {ready && !registration ? (
        <Alert
          tone="warn"
          icon={<Lock aria-hidden className="size-4" />}
          title="Sign-in required"
          actions={
            <Link
              href="/register"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-lime px-3 font-mono text-xs tracking-[0.1em] text-bg uppercase hover:shadow-glow-lime"
            >
              <ArrowLeft aria-hidden className="size-3.5" /> Go to Sign-in &amp; Register
            </Link>
          }
        >
          Sign in with your mobile number on Screen 01 before using this section.
        </Alert>
      ) : registration ? (
        <Panel>
          <PanelHeader
            eyebrow="D1 — Users & Vehicles"
            title="Account state from Screen 01"
            action={registration.isDemoData ? <Badge tone="warn">Demo data</Badge> : undefined}
          />
          <dl className="grid grid-cols-2 gap-4 p-4 sm:p-6 lg:grid-cols-4">
            <KV label="User" mono>
              {registration.userId}
            </KV>
            <KV label="Mobile (masked)" mono>
              {registration.phone.masked}
            </KV>
            <KV label="Reward account" mono>
              {shortAddress(registration.wallet.address)}
            </KV>
            <KV label="Saved vehicles">{registration.transport ? (registration.transport.registeredVehicles.length ? `${registration.transport.registeredVehicles.length}` : "None (metro / bus / walking)") : "Not set"}</KV>
            <KV label="Modes you use">{registration.transport ? `${registration.transport.preferredModes.length}` : "Not set"}</KV>
            <KV label="Ride-hail">{registration.transport?.preferredModes.includes("ride_hail") ? "Yes" : "—"}</KV>
            <KV label="Registered">{formatTimestamp(registration.registeredAt)}</KV>
            <KV label="Chain ID" mono>
              {registration.wallet.chainId}
            </KV>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}
