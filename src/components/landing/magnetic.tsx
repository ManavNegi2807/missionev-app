"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { hasFinePointer, prefersReducedMotion } from "./use-pointer";

/** Pulls its child a few pixels toward the cursor when the cursor is near, like a magnet. Inert on touch and reduced motion. */
export function Magnetic({ children, strength = 0.32, radius = 120, className }: { children: ReactNode; strength?: number; radius?: number; className?: string }) {
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
      x = near ? dx * strength : 0;
      y = near ? dy * strength : 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    el.style.transition = "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)";
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [strength, radius]);

  return (
    <span ref={ref} className={className ?? "inline-block"}>
      {children}
    </span>
  );
}
