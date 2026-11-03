"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "./use-pointer";

/**
 * A number that counts up the first time it scrolls into view. The server renders the final value, so it is correct without
 * scripts and for reduced-motion visitors; the animation writes to the DOM directly instead of re-rendering.
 */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "", className }: { to: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = (v: number) => `${prefix}${v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const node = el.firstChild;
    if (!node) return;
    let raf = 0;
    node.nodeValue = text(0);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const run = (t: number) => {
          const p = Math.min(1, (t - start) / 1400);
          node.nodeValue = text(to * (1 - (1 - p) ** 3));
          if (p < 1) raf = requestAnimationFrame(run);
        };
        raf = requestAnimationFrame(run);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      node.nodeValue = text(to);
    };
    // text() only closes over the formatting props, which belong in the dependency list with `to`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, decimals, prefix, suffix]);

  return (
    <span ref={ref} className={className}>
      {text(to)}
    </span>
  );
}
