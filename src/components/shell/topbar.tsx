"use client";

import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { navForPath } from "@/lib/nav";
import { useWallet } from "@/providers/wallet-provider";
import { NetworkIndicator } from "./network-indicator";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

export function Topbar({
  collapsed,
  onToggleCollapsed,
  onOpenDrawer,
  drawerOpen,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenDrawer: () => void;
  drawerOpen: boolean;
}) {
  const pathname = usePathname();
  const current = navForPath(pathname);
  const { isDemo } = useWallet();

  const iconBtn =
    "grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-fg";

  return (
    <header className="glass-bar sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line px-3 sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open navigation"
        aria-expanded={drawerOpen}
        className={`${iconBtn} lg:hidden`}
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
        className={`${iconBtn} hidden lg:grid`}
      >
        {collapsed ? <PanelLeftOpen aria-hidden className="size-[18px]" /> : <PanelLeftClose aria-hidden className="size-[18px]" />}
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-2 font-mono text-[11px] tracking-normal text-muted sm:text-xs sm:tracking-[0.08em]">
          <li className="hidden shrink-0 sm:block">MissionEV</li>
          <li aria-hidden className="hidden shrink-0 text-line-strong sm:block">
            /
          </li>
          <li aria-current="page" className="truncate text-fg">
            {current.label}
          </li>
        </ol>
      </nav>

      {isDemo && (
        <Badge tone="warn" className="hidden lg:inline-flex">
          Demo mode
        </Badge>
      )}
      <NetworkIndicator />
      <ThemeToggle />
      <WalletButton />
    </header>
  );
}
