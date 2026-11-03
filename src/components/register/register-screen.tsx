"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useWallet } from "@/providers/wallet-provider";
import { DataPanel } from "./data-panel";
import { SigninPanel } from "./signin-panel";
import { StepProgress } from "./step-progress";
import { SummaryPanel } from "./summary-panel";
import { TransportPanel } from "./transport-panel";

const NEXT_ROUTE = "/capture-trip";

export function RegisterScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const { registration, signIn, saveTransport, resetRegistration } = useOnboarding();

  const signOut = useCallback(() => {
    void wallet.disconnect();
    resetRegistration();
  }, [wallet, resetRegistration]);

  const goNext = useCallback(() => router.push(NEXT_ROUTE), [router]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="page-title" className="space-y-5">
        <p className="font-mono text-[11px] tracking-[0.2em] text-lime sm:text-xs">01 / SIGN-IN &amp; TRANSPORT PROFILE</p>
        <h1 id="page-title" className="max-w-3xl text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Connect your wallet. Tell us how you commute.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
          Sign in with MetaMask, then add the vehicles and transport modes you regularly use. Each journey asks how you actually travelled, so a metro rider with no vehicle earns just like an EV owner.
        </p>
        <StepProgress step={1} />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
          <SigninPanel account={registration} onSignIn={signIn} onSignOut={signOut} />
          {/* Keyed by account so unsaved edits never carry over to a different wallet or a later sign-in. */}
          <TransportPanel key={registration?.userId ?? "signed-out"} account={registration} saved={registration?.transport ?? null} onSave={saveTransport} />
        </div>
        <div className="min-w-0 lg:col-span-5 xl:col-span-4">
          <SummaryPanel account={registration} onContinue={goNext} onReset={signOut} />
        </div>
      </div>

      <DataPanel />
    </div>
  );
}
