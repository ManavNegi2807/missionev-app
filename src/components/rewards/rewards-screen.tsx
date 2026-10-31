"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Lock, Wallet } from "lucide-react";
import { StageTracker, type StageState } from "@/components/ui/stage-tracker";
import { Alert, Badge } from "@/components/ui/primitives";
import { Toaster, useToasts } from "@/components/ui/toaster";
import { shortAddress } from "@/lib/format";
import type { CatalogItem } from "@/lib/rewards/catalog";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useRewards } from "@/providers/rewards-provider";
import { useTrip } from "@/providers/trip-provider";
import { useWallet } from "@/providers/wallet-provider";
import { DetailDrawer } from "./detail-drawer";
import { HistorySection } from "./history-section";
import { Marketplace } from "./marketplace";
import { OnchainActivity } from "./onchain-activity";
import { RedeemModal } from "./redeem-modal";
import { RewardStats } from "./reward-stats";
import { RewardsFlow } from "./rewards-flow";
import { TokenOverview } from "./token-overview";

const STAGES = ["Registered", "Captured", "Verified", "Calculated", "Recorded", "Redeemed"] as const;

function RewardsPipeline() {
  const { isRegistered } = useOnboarding();
  const { history } = useTrip();
  const { summary } = useRewards();
  const verified = history.some((t) => t.status === "VERIFIED" && t.carbon);
  const confirmed = history.some((t) => t.settlement.phase === "confirmed");
  const previewed = history.some((t) => t.settlement.phase === "demo-credited");
  const redeemed = summary.successfulRedemptions > 0;

  const raw: Array<StageState | "open"> = [
    isRegistered ? "done" : "open",
    verified ? "done" : "open",
    verified ? "done" : "open",
    verified ? "done" : "open",
    confirmed ? "done" : previewed ? "preview" : "open",
    redeemed ? "done" : "open",
  ];
  const firstOpen = raw.findIndex((s) => s === "open" || s === "preview");
  const states: StageState[] = raw.map((s, i) => {
    if (s === "done" || s === "preview") return s;
    // Redeeming is possible from demo credits, so it stays reachable once registered.
    return i === firstOpen || (i === 5 && isRegistered && !redeemed && raw[4] !== "open") ? "active" : "pending";
  });
  return <StageTracker labels={STAGES} states={states} ariaLabel="Rewards journey" />;
}

export function RewardsScreen() {
  const { ready, isRegistered } = useOnboarding();
  const wallet = useWallet();
  const { toasts, push, dismiss } = useToasts();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <section aria-labelledby="rewards-title" className="space-y-4">
        <p className="font-mono text-[11px] tracking-[0.2em] text-lime sm:text-xs">03 / CARBONCOIN ECONOMY</p>
        <h1 id="rewards-title" className="max-w-3xl text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Impact has its rewards.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
          Turn cleaner mobility choices into a transparent reward history and redeem eligible mobility benefits.
        </p>
      </section>

      <div className="space-y-4">
        <RewardsPipeline />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel/60 px-4 py-3 text-sm" aria-label="Connected wallet">
          <Wallet aria-hidden className="size-4 shrink-0 text-cyan" />
          {wallet.isConnected ? (
            <>
              <span className="text-muted">Optional wallet</span>
              <span className="font-mono text-fg" data-testid="wallet-chip">
                {shortAddress(wallet.address)}
              </span>
              <span className="text-muted">·</span>
              <span className="text-fg">{wallet.isDemo ? `${wallet.networkName} (demo)` : wallet.networkName}</span>
              {wallet.isDemo && <Badge tone="warn">Demo wallet</Badge>}
              {!wallet.isDemo && !wallet.onExpectedChain && <Badge tone="warn">Wrong network</Badge>}
            </>
          ) : (
            <span className="text-muted">
              No wallet needed: rewards are tracked on your demo account. Connect a wallet from the account menu only to read a real $MEV balance or redeem on-chain.
            </span>
          )}
        </div>
      </div>

      {ready && !isRegistered ? (
        <Alert
          role="alert"
          tone="warn"
          icon={<Lock aria-hidden className="size-4" />}
          title="Sign-in required"
          actions={
            <Link href="/register" className="inline-flex h-8 items-center gap-2 rounded-lg bg-lime px-3 font-mono text-xs tracking-[0.1em] text-bg uppercase hover:shadow-glow-lime">
              <ArrowLeft aria-hidden className="size-3.5" /> Go to Sign-in &amp; Register
            </Link>
          }
        >
          Rewards belong to your account. Sign in with your mobile number on Screen 01 first (the demo OTP works).
        </Alert>
      ) : (
        <>
          <TokenOverview />
          <RewardStats />
          <Marketplace onRedeem={setItem} />
          <HistorySection onOpen={setDrawerId} />
          <OnchainActivity />
          <RewardsFlow />
        </>
      )}

      {item && <RedeemModal item={item} onClose={() => setItem(null)} onViewRecord={setDrawerId} notify={push} />}
      {drawerId && <DetailDrawer id={drawerId} onClose={() => setDrawerId(null)} />}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
