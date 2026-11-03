"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/format";

/** A card whose border and background glow where the cursor is (see .lp-card in landing.css). */
export function SpotlightCard({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn("lp-card lp-lift rounded-2xl border border-line bg-panel shadow-panel", className)}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--cx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--cy", `${e.clientY - r.top}px`);
        rest.onPointerMove?.(e);
      }}
    >
      {children}
    </div>
  );
}
