"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LaunchLink } from "./launch-link";

const LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Try the maths", href: "#try" },
  { label: "Why Portal V3", href: "#portal" },
  { label: "What's real", href: "#honest" },
];

export function LandingNav() {
  const ref = useRef<HTMLElement>(null);

  // Frosted bar after the first scroll, and a thin reading-progress line. Both are written straight to the DOM.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.dataset.scrolled = y > 8 ? "true" : "false";
      el.style.setProperty("--sp", max > 0 ? Math.min(1, y / max).toFixed(4) : "0");
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header ref={ref} data-scrolled="false" className="lp-nav fixed inset-x-0 top-0 z-50 border-b border-transparent transition-colors duration-300">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="MissionEV home" className="flex shrink-0 items-center gap-3">
          <LogoMark className="size-8" />
          <span className="hidden sm:block">
            <Wordmark />
          </span>
        </Link>
        <nav aria-label="Page sections" className="ml-6 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-fg/[0.05] hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <LaunchLink size="sm" label="Launch app" />
        </div>
      </div>
      <div aria-hidden className="lp-progress absolute inset-x-0 bottom-[-1px] h-[2px] bg-lime" />
    </header>
  );
}
