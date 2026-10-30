"use client";

import { cn } from "@/lib/format";
import { useSystemStatus } from "./use-system-status";

const tone = {
  neutral: "border-line text-muted",
  ok: "border-ok/35 text-ok bg-ok/[0.06]",
  warn: "border-warn/40 text-warn bg-warn/[0.07]",
  cyan: "border-cyan/35 text-cyan",
} as const;
const dot = { neutral: "bg-muted", ok: "bg-ok", warn: "bg-warn", cyan: "bg-cyan" } as const;

export function NetworkIndicator() {
  const s = useSystemStatus();
  return (
    <div
      role="status"
      aria-label={`Network: ${s.label}`}
      title={s.label}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-lg border px-2.5 font-mono text-[10.5px] tracking-[0.1em] whitespace-nowrap",
        tone[s.tone],
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dot[s.tone], s.tone === "ok" && "shadow-[0_0_8px_var(--color-ok)]")} />
      <span className="hidden md:inline">{s.short}</span>
    </div>
  );
}
