"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

/** Eases between values over ~300 ms. Jumps instantly under prefers-reduced-motion. */
export function AnimatedNumber({ value, decimals = 2, className }: { value: number; decimals?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const a = from.current;
    const b = value;
    let raf = 0;
    if (reduce || a === b) {
      from.current = b;
      raf = requestAnimationFrame(() => setShown(b));
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 300);
      const v = a + (b - a) * (1 - (1 - t) ** 3);
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={cn("tabular-nums", className)}>{shown.toFixed(decimals)}</span>;
}
