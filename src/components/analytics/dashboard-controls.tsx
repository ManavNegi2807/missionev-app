"use client";

import { useId } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button, Panel } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { MODE_LIST, type ModeId } from "@/lib/analytics/modes";
import type { Scope } from "@/lib/analytics/types";

export type Preset = 7 | 30 | 90 | "custom";

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="section-label mb-1.5">{label}</legend>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-bg-2 p-1">
        {options.map((o) => (
          <label key={String(o.value)} className="relative">
            <input type="radio" name={name} value={String(o.value)} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
            <span
              className={cn(
                "flex h-9 cursor-pointer items-center rounded-lg px-3 font-mono text-xs tracking-[0.06em] whitespace-nowrap uppercase transition",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan",
                value === o.value ? "bg-lime text-bg" : "text-muted hover:bg-fg/[0.05] hover:text-fg",
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg hover:border-line-strong focus-visible:border-cyan/60 focus-visible:ring-2 focus-visible:ring-cyan/30 focus-visible:outline-none";

export interface ControlsProps {
  preset: Preset;
  onPreset: (p: Preset) => void;
  custom: { from: string; to: string };
  onCustom: (c: { from: string; to: string }) => void;
  customError: string | null;
  minIso: string;
  maxIso: string;
  mode: ModeId | "all";
  onMode: (m: ModeId | "all") => void;
  scope: Scope;
  onScope: (s: Scope) => void;
  onCsv: () => void;
  csvDisabled: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  summary: string;
}

export function DashboardControls(p: ControlsProps) {
  return (
    <Panel aria-label="Dashboard controls" className="p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-end">
        <Segmented<Preset>
          label="Date range"
          value={p.preset}
          onChange={p.onPreset}
          options={[
            { value: 7, label: "7 days" },
            { value: 30, label: "30 days" },
            { value: 90, label: "90 days" },
            { value: "custom", label: "Custom" },
          ]}
        />

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="section-label mb-1.5 block">Transport mode</span>
            <select className={inputCls} value={p.mode} onChange={(e) => p.onMode(e.target.value as ModeId | "all")} aria-label="Transport mode filter">
              <option value="all">All modes</option>
              {MODE_LIST.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <Segmented<Scope>
            label="Scope"
            value={p.scope}
            onChange={p.onScope}
            options={[
              { value: "community", label: "Community" },
              { value: "me", label: "My trips" },
            ]}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={p.onCsv} disabled={p.csvDisabled} icon={<Download aria-hidden className="size-4" />} title={p.csvDisabled ? "Nothing to export for these filters" : "Download aggregate CSV for the current filters"}>
            Download CSV
          </Button>
          <Button onClick={p.onRefresh} loading={p.refreshing} icon={<RefreshCw aria-hidden className="size-4" />}>
            Refresh
          </Button>
        </div>
      </div>

      {p.preset === "custom" && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:max-w-xl">
          <label className="block">
            <span className="section-label mb-1.5 block">From</span>
            <input type="date" className={inputCls} value={p.custom.from} min={p.minIso} max={p.maxIso} onChange={(e) => p.onCustom({ ...p.custom, from: e.target.value })} aria-invalid={p.customError ? true : undefined} />
          </label>
          <label className="block">
            <span className="section-label mb-1.5 block">To</span>
            <input type="date" className={inputCls} value={p.custom.to} min={p.minIso} max={p.maxIso} onChange={(e) => p.onCustom({ ...p.custom, to: e.target.value })} aria-invalid={p.customError ? true : undefined} />
          </label>
          {p.customError && (
            <p role="alert" className="text-xs text-err sm:col-span-2">
              {p.customError}
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted" aria-live="polite" data-testid="controls-summary">
        {p.summary}
      </p>
    </Panel>
  );
}
