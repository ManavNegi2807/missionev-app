"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { maskPhone } from "@/lib/auth";
import { PORTAL_V3 } from "@/lib/chain";
import { fnv1a, sha256Hex } from "@/lib/format";
import { useOnboarding } from "@/providers/onboarding-provider";
import { DEMO_ADDRESS } from "@/providers/wallet-provider";
import { DataFlowPanel } from "./data-flow-panel";
import { SigninPanel } from "./signin-panel";
import { StepProgress } from "./step-progress";
import { SummaryPanel } from "./summary-panel";
import { TransportPanel } from "./transport-panel";

const NEXT_ROUTE = "/capture-trip";

export function RegisterScreen() {
  const router = useRouter();
  const { registration, saveRegistration, saveTransport, resetRegistration } = useOnboarding();

  const onVerified = useCallback(
    async (phone: string) => {
      // Keep only a short, one-way fingerprint as the user id; the number itself is never stored.
      const hash = await sha256Hex(`missionev:v1:phone:${phone}`);
      const id = (hash ?? fnv1a(phone).toString(16).padStart(8, "0")).slice(0, 8);
      const now = Date.now();
      saveRegistration({
        userId: `usr_${id}`,
        phone: { masked: maskPhone(phone), verifiedAt: now, method: "demo-otp" },
        transport: null,
        wallet: { address: DEMO_ADDRESS, chainId: PORTAL_V3.chainId, mode: "demo" },
        isDemoData: true,
        registeredAt: now,
      });
    },
    [saveRegistration],
  );

  const goNext = useCallback(() => router.push(NEXT_ROUTE), [router]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="page-title" className="space-y-5">
        <p className="font-mono text-[11px] tracking-[0.2em] text-lime sm:text-xs">01 / SIGN-IN &amp; TRANSPORT PROFILE</p>
        <h1 id="page-title" className="max-w-3xl text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Sign in. Tell us how you commute.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
          Sign in with your mobile number, then add the vehicles and transport modes you regularly use. Each journey asks how you actually travelled, so a metro rider with no vehicle earns just like an EV owner.
        </p>
        <StepProgress step={1} label="ACCOUNT INITIALIZATION" />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
          <SigninPanel account={registration} onVerified={onVerified} onSignOut={resetRegistration} />
          <TransportPanel account={registration} saved={registration?.transport ?? null} onSave={saveTransport} />
        </div>
        <div className="min-w-0 lg:col-span-5 xl:col-span-4">
          <SummaryPanel account={registration} onContinue={goNext} onReset={resetRegistration} />
        </div>
      </div>

      <DataFlowPanel />
    </div>
  );
}
