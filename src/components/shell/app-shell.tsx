"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Reusable application shell for all four MissionEV screens.
 * Desktop (lg+): fixed 248px sidebar (collapsible to 72px) + 64px topbar.
 * Below lg: sidebar becomes a slide-in drawer.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  return (
    <div className="bg-technical min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-lime px-3 py-2 font-mono text-xs text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside
        aria-label="Sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-line transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            className="absolute inset-0 bg-shade/50 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] border-r border-line-strong shadow-2xl shadow-black">
            <Sidebar onNavigate={() => setDrawer(false)} onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]")}>
        <Topbar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          onOpenDrawer={() => setDrawer(true)}
          drawerOpen={drawer}
        />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
