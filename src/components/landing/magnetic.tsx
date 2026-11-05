"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hasFinePointer, prefersReducedMotion } from "./use-pointer";

/**
 * Nudges its child a few pixels toward the cursor when the cursor is near, like a magnet. The nudge is capped at `max` px so a
 * button can never slide into its neighbour (it used to follow the cursor by a third of the distance and overlap the button beside
 * it). Inert on touch and reduced motion.
 */
export function Magnetic({ children, strength = 0.12, radius = 80, max = 6, className }: { children: ReactNode; strength?: number; radius?: number; max?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasFinePointer() || prefersReducedMotion()) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const near = Math.hypot(dx, dy) < radius + Math.max(r.width, r.height) / 2;
      const cap = (n: number) => Math.max(-max, Math.min(max, n));
      x = near ? cap(dx * strength) : 0;
      y = near ? cap(dy * strength) : 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    el.style.transition = "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)";
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [strength, radius, max]);

  return (
    <span ref={ref} className={className ?? "inline-block"}>
      {children}
    </span>
  );
}
