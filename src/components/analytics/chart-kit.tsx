"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

/** Colours for SVG: theme variables, so charts follow the light/dark theme without re-rendering. */
export const C = {
  grid: "var(--chart-grid)",
  axis: "var(--color-muted)",
  lime: "var(--color-lime)",
  cyan: "var(--color-cyan)",
  warn: "var(--color-warn)",
  err: "var(--color-err)",
  muted: "var(--color-muted)",
  fg: "var(--color-fg)",
} as const;

const mql = () => (typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null);
const subscribeMotion = (cb: () => void) => {
  const m = mql();
  m?.addEventListener("change", cb);
  return () => m?.removeEventListener("change", cb);
};
export const useReducedMotion = () => useSyncExternalStore(subscribeMotion, () => mql()?.matches ?? false, () => false);

export type SourceKind = "demo" | "session" | "onchain" | "mixed" | "none";
const SOURCE: Record<SourceKind, { tone: "warn" | "ok" | "neutral" | "cyan"; text: string }> = {
  demo: { tone: "warn", text: "Demo data" },
  session: { tone: "neutral", text: "Session data" },
  mixed: { tone: "warn", text: "Demo + session" },
  onchain: { tone: "ok", text: "On-chain" },
  none: { tone: "neutral", text: "No data" },
};
export function SourceBadge({ kind, label }: { kind: SourceKind; label?: string }) {
  const s = SOURCE[kind];
  return (
    <Badge tone={s.tone} dot>
      {label ?? s.text}
    </Badge>
  );
}

export function ChartTip({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="pointer-events-none max-w-[16rem] rounded-lg border border-line-strong bg-bg-2/95 px-3 py-2.5 text-xs shadow-xl shadow-shade/15 backdrop-blur">
      {title && <p className="mb-1.5 font-mono text-[11px] tracking-wide text-muted uppercase">{title}</p>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}
export function TipRow({ color, label, value, dashed }: { color?: string; label: string; value: string; dashed?: boolean }) {
  return (
    <p className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted">
        {color && <span aria-hidden className="inline-block shrink-0" style={dashed ? { width: 12, borderTop: `2px dashed ${color}` } : { width: 8, height: 8, borderRadius: 999, background: color }} />}
        {label}
      </span>
      <span className="font-mono text-fg">{value}</span>
    </p>
  );
}

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  hint?: string;
}
/** Legend that doubles as series toggles. */
export function LegendToggles({ items, hidden, onToggle, label }: { items: LegendItem[]; hidden: ReadonlySet<string>; onToggle: (key: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((it) => {
        const off = hidden.has(it.key);
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={!off}
            data-legend={it.key}
            title={it.hint}
            onClick={() => onToggle(it.key)}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition",
              off ? "border-line text-muted/70 line-through decoration-muted/50" : "border-line-strong bg-fg/[0.03] text-fg hover:border-cyan/50",
            )}
          >
            <span aria-hidden className="inline-block h-0 w-4 border-t-2" style={{ borderColor: off ? "var(--chart-dash-off)" : it.color, borderStyle: it.dashed ? "dashed" : "solid" }} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Inbox aria-hidden className="size-8 text-muted" />
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-lg", className)} />;
}

export const kg = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));
