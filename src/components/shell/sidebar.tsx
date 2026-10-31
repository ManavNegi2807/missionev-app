"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, Coins, Lock, Route, UserRoundCheck, X, type LucideIcon } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/format";
import { NAV_ITEMS, navForPath } from "@/lib/nav";
import { PORTAL_V3 } from "@/lib/chain";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useSystemStatus } from "./use-system-status";

const toneText = { neutral: "text-muted", ok: "text-ok", warn: "text-warn", cyan: "text-cyan" } as const;
const toneDot = { neutral: "bg-muted", ok: "bg-ok", warn: "bg-warn", cyan: "bg-cyan" } as const;

/** Shown in the collapsed rail, where the label is hidden. */
const NAV_ICONS: Record<string, LucideIcon> = {
  "/register": UserRoundCheck,
  "/capture-trip": Route,
  "/rewards": Coins,
  "/analytics": ChartColumn,
};

export function Sidebar({
  collapsed = false,
  onNavigate,
  onClose,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Provided for the mobile drawer only. */
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const active = navForPath(pathname);
  const { isRegistered, ready } = useOnboarding();
  const status = useSystemStatus();

  return (
    <div className="flex h-full flex-col bg-bg-2">
      <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-line", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/register" onClick={onNavigate} aria-label="MissionEV home" className="flex min-w-0 items-center gap-3 rounded-lg">
          <LogoMark className="size-8 shrink-0" />
          <Wordmark compact={collapsed} />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto grid size-9 place-items-center rounded-lg text-muted hover:bg-fg/[0.05] hover:text-fg"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Primary" className={cn("flex-1 overflow-y-auto py-5", collapsed ? "px-2" : "px-3")}>
        {!collapsed && <p className="section-label mb-3 px-3">Workflow</p>}
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === active.href;
            const locked = ready && item.requiresRegistration && !isRegistered;
            const Icon = NAV_ICONS[item.href];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={collapsed ? `${item.step} ${item.label}${locked ? " (locked until signed in)" : ""}` : undefined}
                  title={collapsed ? `${item.step} — ${item.label}` : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg py-2.5 transition",
                    collapsed ? "flex-col justify-center gap-1 px-0" : "px-2.5",
                    isActive
                      ? "bg-gradient-to-r from-lime/[0.12] to-transparent text-fg"
                      : "text-muted hover:bg-fg/[0.04] hover:text-fg",
                  )}
                >
                  {isActive && (
                    <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-lime shadow-[0_0_12px_color-mix(in_srgb,var(--color-lime)_45%,transparent)]" />
                  )}
                  {collapsed && Icon && (
                    <span className="relative">
                      <Icon aria-hidden className={cn("size-5", isActive ? "text-lime" : "text-muted group-hover:text-fg")} strokeWidth={1.75} />
                      {locked && <Lock aria-hidden className="absolute -right-1.5 -bottom-1 size-3 rounded-full bg-bg-2 text-muted" />}
                    </span>
                  )}
                  <span className={cn("font-mono text-[11px] tracking-wider", isActive ? "text-lime" : "text-muted")}>{item.step}</span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.label}</span>
                      {locked && <Lock aria-label="Locked until you sign in" className="size-3.5 shrink-0 text-muted/70" />}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("shrink-0 border-t border-line", collapsed ? "p-2" : "p-4")}>
        {collapsed ? (
          <div className="flex justify-center py-1" title={`${PORTAL_V3.name.toUpperCase()} · ${status.label}`}>
            <span aria-hidden className={cn("size-2 rounded-full", toneDot[status.tone])} />
            <span className="sr-only">System status: {status.label}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-panel/70 p-3">
            <p className="font-mono text-[10.5px] font-medium tracking-[0.16em] text-fg">PORTAL V3 TESTNET</p>
            <p className="mt-2 flex items-start gap-2 font-mono text-[11px] leading-4 tracking-[0.1em] text-muted">
              <span aria-hidden className={cn("mt-1 size-1.5 shrink-0 rounded-full", toneDot[status.tone])} />
              <span>
                SYSTEM STATUS: <span className={toneText[status.tone]}>{status.label}</span>
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
