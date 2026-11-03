"use client";

import { useRef } from "react";
import { ArrowDown, FileCheck, ShieldCheck, Wallet } from "lucide-react";
import { HeroCard } from "./hero-card";
import { LaunchLink } from "./launch-link";
import { Magnetic } from "./magnetic";
import { NetworkCanvas } from "./network-canvas";
import { usePointerVars } from "./use-pointer";

const TRUST = [
  { icon: Wallet, text: "Your wallet is your account" },
  { icon: ShieldCheck, text: "No phone number, no password" },
  { icon: FileCheck, text: "Open source, MIT licensed" },
];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  usePointerVars(ref);

  return (
    <section ref={ref} aria-labelledby="hero-title" className="lp-hero relative isolate overflow-hidden">
      <div aria-hidden className="lp-spot pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="lp-grid pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="lp-grid-lit pointer-events-none absolute inset-0 -z-10" />
      <NetworkCanvas className="absolute inset-0 -z-10" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-32 pb-20 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 lg:pt-40 lg:pb-28">
        <div>
          <p className="inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-panel/70 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.14em] text-muted uppercase backdrop-blur">
            <span className="relative flex size-2">
              <span className="lp-ping absolute inline-flex size-full rounded-full bg-lime opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-lime" />
            </span>
            Live on Portal V3 testnet
          </p>

          <h1 id="hero-title" className="mt-6 max-w-2xl text-[2.9rem] leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-[4.4rem]">
            A Strava for <span className="lp-gradient-text">carbon</span>.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty">
            Reward the journey you chose, not the car you own. MissionEV measures each trip, verifies it, and pays <span className="font-medium text-fg">$MEV</span> for the CO₂ you actually avoided.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Magnetic className="block sm:inline-block">
              <LaunchLink size="lg" className="w-full sm:w-auto" />
            </Magnetic>
            <a
              href="#how"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-line-strong bg-panel/60 px-6 font-mono text-[13px] tracking-[0.1em] text-fg uppercase backdrop-blur transition hover:border-cyan/50 hover:text-cyan"
            >
              See how it works
              <ArrowDown aria-hidden className="size-4 transition-transform group-hover:translate-y-0.5" />
            </a>
          </div>
          <p className="mt-4 max-w-md text-sm text-muted">On the next screen you connect MetaMask. No wallet? Explore with a demo account.</p>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon aria-hidden className="size-4 text-lime" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <HeroCard />
      </div>
    </section>
  );
}
