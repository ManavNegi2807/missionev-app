"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { prefersReducedMotion } from "./use-pointer";

/**
 * Fades a block in as it scrolls into view. The hidden state is applied by script only to blocks that start off-screen, so
 * the page is fully visible with scripts disabled, for reduced-motion visitors, and for everything already in view.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92 && r.bottom > 0) return;
    el.setAttribute("data-armed", "");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.setAttribute("data-in", "");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeAttribute("data-armed");
      el.removeAttribute("data-in");
    };
  }, []);

  return (
    <div ref={ref} className={cn("lp-reveal", className)} style={{ "--delay": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}
