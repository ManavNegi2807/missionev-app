"use client";

import { useEffect, type RefObject } from "react";

/** Hover-capable mouse or trackpad, not a touch screen. */
export const hasFinePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Drives the hero's pointer variables on `ref`: --mx/--my (cursor position in px) and --px/--py (offset from the centre,
 * -1..1). Values glide toward the cursor instead of snapping, and settle back to a resting position when it leaves.
 * Nothing here touches React state, so moving the mouse never re-renders anything. Does nothing on touch screens or
 * when the visitor prefers reduced motion; the CSS defaults then show a calm, centred hero.
 */
export function usePointerVars(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasFinePointer() || prefersReducedMotion()) return;

    const rest = () => {
      const r = el.getBoundingClientRect();
      return { mx: r.width * 0.64, my: r.height * 0.32, px: 0, py: 0 };
    };
    const target = rest();
    const now = { ...target };
    let raf = 0;

    const write = () => {
      el.style.setProperty("--mx", `${now.mx.toFixed(1)}px`);
      el.style.setProperty("--my", `${now.my.toFixed(1)}px`);
      el.style.setProperty("--px", now.px.toFixed(3));
      el.style.setProperty("--py", now.py.toFixed(3));
    };

    const tick = () => {
      raf = 0;
      let moving = false;
      for (const k of ["mx", "my", "px", "py"] as const) {
        const d = target[k] - now[k];
        const eps = k === "mx" || k === "my" ? 0.4 : 0.003;
        if (Math.abs(d) > eps) {
          now[k] += d * 0.16;
          moving = true;
        } else {
          now[k] = target[k];
        }
      }
      write();
      if (moving) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      target.mx = e.clientX - r.left;
      target.my = e.clientY - r.top;
      target.px = clamp((target.mx / r.width - 0.5) * 2, -1, 1);
      target.py = clamp((target.my / r.height - 0.5) * 2, -1, 1);
      kick();
    };
    const onLeave = () => {
      Object.assign(target, rest());
      kick();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}
