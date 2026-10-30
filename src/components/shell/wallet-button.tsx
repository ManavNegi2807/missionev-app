"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Copy, FlaskConical, LogOut, UserRound, Wallet } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { cn, fnv1a, formatTimestamp, shortAddress } from "@/lib/format";
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

export function WalletButton() {
  const w = useWallet();
  const { isRegistered, resetRegistration } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open || Boolean(w.error), ref, () => {
    close();
    w.clearError();
  });

  const copy = async () => {
    if (!w.address) return;
    try {
      await navigator.clipboard.writeText(w.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (!w.isConnected) {
    return (
      <div ref={ref} className="relative">
        <Button
          size="md"
          variant="primary"
          loading={w.connecting}
          icon={<Wallet aria-hidden className="size-4" />}
          onClick={w.connect}
          className="h-9 px-3 sm:px-4"
          aria-label="Connect wallet"
        >
          <span className="hidden sm:inline">Connect Wallet</span>
          <span className="sm:hidden">Connect</span>
        </Button>
        {w.error && (
          <div className="absolute top-full right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] shadow-2xl shadow-shade/15">
            <div className="rounded-xl bg-panel">
              <WalletError />
            </div>
          </div>
        )}
      </div>
    );
  }

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
        <Avatar seed={w.address ?? ""} />
        <span className="max-w-[7.5rem] truncate">{shortAddress(w.address)}</span>
        <ChevronDown aria-hidden className={cn("size-3.5 text-muted transition", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="glass absolute top-full right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line-strong p-2 shadow-2xl shadow-shade/15"
        >
          <div className="space-y-2 px-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="section-label">Wallet</p>
              {w.isDemo && <Badge tone="warn">Demo mode</Badge>}
            </div>
            <p className="font-mono text-xs break-all text-fg">{w.address}</p>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="section-label">Network</dt>
                <dd className="mt-0.5 truncate text-fg">{w.networkName}</dd>
              </div>
              <div>
                <dt className="section-label">Chain ID</dt>
                <dd className="mt-0.5 font-mono text-fg">{w.chainId}</dd>
              </div>
            </dl>
            <p className="text-[11px] text-muted">Connected {formatTimestamp(w.connectedAt)}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem icon={copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />} onClick={copy}>
            {copied ? "Address copied" : "Copy address"}
          </MenuItem>
          <Link
            href="/register"
            role="menuitem"
            onClick={close}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-sm text-fg hover:bg-fg/[0.06]"
          >
            <UserRound aria-hidden className="size-4" />
            {isRegistered ? "View registration" : "Registration"}
          </Link>
          {isRegistered && (
            <MenuItem
              icon={<FlaskConical className="size-4" />}
              onClick={() => {
                resetRegistration();
                close();
              }}
            >
              Clear registration
            </MenuItem>
          )}
          <MenuItem
            danger
            icon={<LogOut className="size-4" />}
            onClick={() => {
              close();
              void w.disconnect();
            }}
          >
            {w.isDemo ? "Exit demo mode" : "Disconnect"}
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
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm hover:bg-fg/[0.06]",
        danger ? "text-err" : "text-fg",
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}
