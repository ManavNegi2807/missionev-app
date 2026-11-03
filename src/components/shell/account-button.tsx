"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Copy, LogOut, UserRound, Wallet } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { PORTAL_V3 } from "@/lib/chain";
import { cn, fnv1a, shortAddress } from "@/lib/format";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useWallet } from "@/providers/wallet-provider";
import { useDismiss } from "./use-dismiss";
import { WalletError } from "./wallet-error";

function Avatar({ seed }: { seed: string }) {
  const h = fnv1a(seed);
  return (
    <span
      aria-hidden
      className="size-6 shrink-0 rounded-full border border-line-strong"
      style={{ background: `conic-gradient(from ${h % 360}deg, var(--color-lime), var(--color-cyan), var(--mode-ebus), var(--color-lime))` }}
    />
  );
}

/**
 * Top-bar account control. The account is the connected wallet (or a demo account with no wallet); see Screen 01.
 * Connecting a wallet from here upgrades a demo account, and the onboarding provider keeps the two in step.
 */
export function AccountButton() {
  const w = useWallet();
  const { registration, ready, resetRegistration } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open || Boolean(w.error), ref, () => {
    close();
    w.clearError();
  });

  if (!ready) return <span aria-hidden className="h-9 w-24 shrink-0 animate-pulse rounded-lg bg-fg/[0.06]" />;

  if (!registration) {
    return (
      <Link
        href="/register"
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-lime px-3 font-mono text-xs tracking-[0.1em] text-bg uppercase hover:bg-lime-strong hover:shadow-glow-lime sm:px-4"
      >
        <Wallet aria-hidden className="size-4" />
        <span className="sm:hidden">Sign in</span>
        <span className="hidden sm:inline">Connect wallet</span>
      </Link>
    );
  }

  const isWallet = registration.account.method === "wallet";
  const walletLive = isWallet && w.isConnected && !w.isDemo;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(registration.wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-elevated pr-2 pl-1.5 font-mono text-xs text-fg transition hover:border-cyan/50"
      >
        <Avatar seed={registration.userId} />
        <span className="hidden max-w-[7.5rem] truncate sm:inline">{isWallet ? shortAddress(registration.wallet.address) : "Demo account"}</span>
        <ChevronDown aria-hidden className={cn("size-3.5 text-muted transition", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute top-full right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-panel p-2 shadow-2xl shadow-shade/15"
        >
          <div className="space-y-2 px-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="section-label">Signed in</p>
              {registration.isDemoData && <Badge tone="warn">Demo account</Badge>}
            </div>
            <p className="font-mono text-xs break-all text-fg">{isWallet ? shortAddress(registration.wallet.address) : "No wallet connected"}</p>
            <p className="text-[11px] text-muted">
              User <span className="font-mono text-fg">{registration.userId}</span>
            </p>
            <p className="text-[11px] text-muted">{registration.transport ? `${registration.transport.registeredVehicles.length} saved vehicle${registration.transport.registeredVehicles.length === 1 ? "" : "s"}` : "Transport profile not set"}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            href="/register"
            role="menuitem"
            onClick={close}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-sm text-fg hover:bg-fg/[0.06]"
          >
            <UserRound aria-hidden className="size-4" />
            Transport profile
          </Link>

          <div className="my-1 h-px bg-line" />
          <div className="px-2 py-2">
            <p className="section-label">Wallet</p>
            {walletLive ? (
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Connected on <span className="text-fg">{w.networkName}</span>
                {!w.onExpectedChain && " · MissionEV records trips on Portal V3"}
              </p>
            ) : isWallet ? (
              <p className="mt-1 text-[11px] leading-relaxed text-muted">Not connected in this tab. Reconnect to read your balance or record trips.</p>
            ) : (
              <p className="mt-1 text-[11px] leading-relaxed text-muted">You are exploring with a demo account. Connect MetaMask to sign in with your wallet instead.</p>
            )}
          </div>
          {w.error && (
            <div className="px-1 pb-1">
              <WalletError />
            </div>
          )}
          {walletLive ? (
            <>
              {!w.onExpectedChain && (
                <MenuItem icon={<Wallet className="size-4" />} onClick={() => void w.switchNetwork()}>
                  Switch to {PORTAL_V3.shortName}
                </MenuItem>
              )}
              <MenuItem icon={copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />} onClick={copy}>
                {copied ? "Address copied" : "Copy address"}
              </MenuItem>
            </>
          ) : (
            <div className="px-2 pb-1">
              <Button size="sm" loading={w.connecting} icon={<Wallet aria-hidden className="size-3.5" />} onClick={() => void w.connect()} className="w-full">
                {isWallet ? "Reconnect wallet" : "Connect MetaMask"}
              </Button>
            </div>
          )}

          <div className="my-1 h-px bg-line" />
          <MenuItem
            danger
            icon={<LogOut className="size-4" />}
            onClick={() => {
              close();
              void w.disconnect();
              resetRegistration();
            }}
          >
            Sign out
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn("flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm hover:bg-fg/[0.06]", danger ? "text-err" : "text-fg")}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}
