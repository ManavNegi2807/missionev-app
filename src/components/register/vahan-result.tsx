"use client";

import { useId, useState } from "react";
import { AlertTriangle, BadgeCheck, ChevronDown, RotateCw } from "lucide-react";
import { Alert, Badge, Button, KV } from "@/components/ui/primitives";
import { cn, formatTimestamp } from "@/lib/format";
import type { RegistryFailureCode, RegistryRecord } from "@/lib/vahan";

export function VahanSuccess({ record }: { record: RegistryRecord }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  return (
    <div className="rounded-xl border border-ok/30 bg-ok/[0.04]" role="status">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ok/20 px-4 py-3">
        <BadgeCheck aria-hidden className="size-5 text-ok" />
        <p className="text-sm font-semibold text-ok">Vehicle verified</p>
        <Badge tone="warn">Demo registry</Badge>
        <Badge tone="ok" className="ml-auto">
          RC {record.rcStatus}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 lg:grid-cols-3">
        <KV label="Registration (masked)" mono>
          {record.maskedReg}
        </KV>
        <KV label="Category">{record.category}</KV>
        <KV label="Fuel / power">{record.fuel}</KV>
        <KV label="Manufacturer / model">
          {record.manufacturer} {record.model}
        </KV>
        <KV label="RC status">{record.rcStatus} (demo)</KV>
        <KV label="Verified on">
          {formatTimestamp(record.verifiedAt)}
          {record.verifiedAtIsDemo && <span className="ml-1.5 font-mono text-[11px] text-warn">DEMO</span>}
        </KV>
      </dl>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={regionId}
        className="flex w-full items-center justify-between gap-2 border-t border-ok/20 px-4 py-2.5 font-mono text-[11px] tracking-[0.12em] text-muted uppercase transition hover:text-fg"
      >
        {open ? "Hide verification details" : "Show verification details"}
        <ChevronDown aria-hidden className={cn("size-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <dl id={regionId} className="grid grid-cols-1 gap-4 border-t border-ok/20 p-4 sm:grid-cols-2">
          <KV label="Reference ID" mono>
            {record.referenceId}
          </KV>
          <KV label="Registry source">Local mock adapter (DEMO REGISTRY)</KV>
          <KV label="Purchase year (declared)" mono>
            {record.year}
          </KV>
          <KV label="Data handling">Checked in-browser; nothing was sent to a server</KV>
        </dl>
      )}
    </div>
  );
}

const failureTitle: Record<RegistryFailureCode, string> = {
  NOT_FOUND: "Registration not found",
  RC_INACTIVE: "RC not active",
  REGISTRY_UNAVAILABLE: "Registry unavailable",
};

export function VahanFailure({ code, message, onRetry }: { code: RegistryFailureCode; message: string; onRetry: () => void }) {
  return (
    <Alert
      role="alert"
      tone="err"
      icon={<AlertTriangle aria-hidden className="size-4" />}
      title={`${failureTitle[code]} · ${code}`}
      actions={
        <Button size="sm" icon={<RotateCw aria-hidden className="size-3.5" />} onClick={onRetry}>
          Retry lookup
        </Button>
      }
    >
      {message} <span className="font-mono text-xs text-warn">(DEMO REGISTRY)</span>
    </Alert>
  );
}

export function VahanLoading() {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-cyan/25 bg-cyan/[0.04] p-4">
      <p className="mb-3 font-mono text-xs tracking-[0.12em] text-cyan">QUERYING DEMO REGISTRY…</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-2.5 w-16 rounded" />
            <div className="skeleton h-4 w-full max-w-28 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
