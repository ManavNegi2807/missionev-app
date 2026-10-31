"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, ScanText, Upload } from "lucide-react";
import { SelectField, TextField } from "@/components/ui/fields";
import { Alert, Badge, Button } from "@/components/ui/primitives";
import { useIntegrationStatus } from "@/lib/api/client";
import { cn } from "@/lib/format";
import type { ReceiptExtraction } from "@/lib/ocr/receipt";
import { rideFromExtraction, resolveRideHail, type RideHailForm } from "@/lib/transport/rideHail";
import { useTrip } from "@/providers/trip-provider";

type Ocr = { phase: "idle" } | { phase: "reading" } | { phase: "done"; extraction: ReceiptExtraction } | { phase: "error"; reason: string; unconfigured?: boolean };

const FUELS = { Petrol: "petrol", Diesel: "diesel", CNG: "cng", Electric: "electric" } as const;
const BODIES = { Car: "car", "Two-wheeler": "two_wheeler" } as const;
const PROVIDERS = { Ola: "ola", Uber: "uber", Rapido: "rapido" } as const;
const labelOf = <T extends string>(map: Record<string, T>, v: T | "") => Object.keys(map).find((k) => map[k] === v) ?? "";

const confTone = { high: "ok", medium: "cyan", low: "warn" } as const;

export function RideHailSection({ disabled }: { disabled: boolean }) {
  const { setup, setRide, selection } = useTrip();
  const { status } = useIntegrationStatus();
  const f = setup.ride;
  const [ocr, setOcr] = useState<Ocr>({ phase: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  const res = resolveRideHail(f);
  const conf = f.ocrConfidence;

  useEffect(() => () => void (urlRef.current && URL.revokeObjectURL(urlRef.current)), []);

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    setPreview(urlRef.current);
    if (!status?.ocr.configured) {
      setOcr({ phase: "error", unconfigured: true, reason: "Receipt reading (Azure AI Vision) isn't configured on this server, so nothing was read from the image. Enter the ride details by hand below." });
      return;
    }
    setOcr({ phase: "reading" });
    try {
      const body = new FormData();
      body.append("image", file);
      const r = await fetch("/api/vision/ocr", { method: "POST", body });
      const data = (await r.json().catch(() => ({}))) as { status?: string; reason?: string; extraction?: ReceiptExtraction };
      if (!r.ok || !data.extraction) {
        setOcr({ phase: "error", reason: data.reason ?? "The receipt couldn't be read.", unconfigured: r.status === 501 });
        return;
      }
      setOcr({ phase: "done", extraction: data.extraction });
      const next = rideFromExtraction(data.extraction, f);
      setRide({ ...next, occupants: f.occupants });
    } catch {
      setOcr({ phase: "error", reason: "The upload failed. Check your connection or enter the details by hand." });
    }
  };

  const set = <K extends keyof RideHailForm>(k: K, v: RideHailForm[K]) => setRide({ [k]: v } as Partial<RideHailForm>);
  const ev = f.fuel === "electric";
  const unit = ev ? "kWh/100 km" : f.fuel === "cng" ? "km/kg" : "km/l";

  return (
    <div className="space-y-4 rounded-xl border border-cyan/25 bg-cyan/[0.03] p-3.5 sm:p-4" data-testid="ride-hail">
      <div>
        <p className="section-label">Ride receipt</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Upload the receipt screenshot, review what was read, and confirm the vehicle. OCR only extracts text: it can&apos;t prove the ride happened or what fuel the car uses, and MissionEV has no access to Ola, Uber or Rapido&apos;s own data.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Ride receipt screenshot" disabled={disabled} onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        <Button size="sm" variant="secondary" disabled={disabled} icon={ocr.phase === "reading" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Upload aria-hidden className="size-3.5" />} onClick={() => fileRef.current?.click()}>
          {ocr.phase === "reading" ? "Reading receipt…" : preview ? "Replace screenshot" : "Upload receipt screenshot"}
        </Button>
        <Badge tone={status?.ocr.configured ? "ok" : "warn"} dot>
          {status?.ocr.configured ? "Azure AI Vision · live" : "OCR not configured · manual entry"}
        </Badge>
      </div>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob URL preview; next/image can't optimise it
        <img src={preview} alt="Preview of the receipt screenshot you selected" className="max-h-56 w-auto max-w-full rounded-lg border border-line object-contain" />
      )}
      {ocr.phase === "error" && (
        <Alert tone={ocr.unconfigured ? "neutral" : "warn"} role="status" icon={<AlertTriangle aria-hidden className="size-4" />} title={ocr.unconfigured ? "Reading is off" : "Couldn't read the receipt"}>
          {ocr.reason}
        </Alert>
      )}
      {ocr.phase === "done" && (
        <Alert tone="cyan" role="status" icon={<ScanText aria-hidden className="size-4" />} title="Receipt read — please review">
          {ocr.extraction.notes.map((n) => (
            <span key={n} className="block">
              {n}
            </span>
          ))}
          {ocr.extraction.pickup || ocr.extraction.drop ? <span className="mt-1 block">Pick-up and drop labels were seen but are not stored.</span> : null}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        <SelectField label="Ride provider" required placeholder="Ola, Uber or Rapido" options={Object.keys(PROVIDERS)} value={labelOf(PROVIDERS, f.provider)} disabled={disabled} error={undefined} onChange={(e) => set("provider", (PROVIDERS as Record<string, RideHailForm["provider"]>)[e.target.value] ?? "")} />
        <TextField label="Distance on receipt (km)" required mono inputMode="decimal" autoComplete="off" placeholder="e.g. 12.4" value={f.receiptDistance} disabled={disabled} hint="Cross-checked against your GPS distance (±15%). The calculation uses the GPS distance." onChange={(e) => set("receiptDistance", e.target.value)} />
        <TextField label="Date on receipt (optional)" mono autoComplete="off" placeholder="yyyy-mm-dd" value={f.tripDate} disabled={disabled} onChange={(e) => set("tripDate", e.target.value)} />
        <TextField label="Ride class (optional)" autoComplete="off" placeholder="e.g. Prime Sedan, Mini, Bike" value={f.serviceClass} disabled={disabled} onChange={(e) => set("serviceClass", e.target.value)} />
        <TextField label="Vehicle manufacturer" autoComplete="off" placeholder="e.g. Maruti Suzuki" value={f.manufacturer} disabled={disabled} onChange={(e) => set("manufacturer", e.target.value)} />
        <TextField label="Vehicle model" required autoComplete="off" placeholder="e.g. Dzire" value={f.model} disabled={disabled} onChange={(e) => set("model", e.target.value)} />
        <SelectField label="Vehicle type" required placeholder="Car or two-wheeler" options={Object.keys(BODIES)} value={labelOf(BODIES, f.body)} disabled={disabled} onChange={(e) => set("body", (BODIES as Record<string, RideHailForm["body"]>)[e.target.value] ?? "")} />
        <SelectField label="Fuel (confirm)" required placeholder="Petrol, diesel, CNG or electric" options={Object.keys(FUELS)} value={labelOf(FUELS, f.fuel)} disabled={disabled} hint="The receipt rarely says. Only choose Electric if you know the vehicle is electric." onChange={(e) => set("fuel", (FUELS as Record<string, RideHailForm["fuel"]>)[e.target.value] ?? "")} />
        <TextField label="People sharing the ride" mono inputMode="numeric" autoComplete="off" value={String(f.occupants)} disabled={disabled} hint="The vehicle's emissions are shared across them." onChange={(e) => set("occupants", Math.max(1, Math.min(8, Math.floor(Number(e.target.value) || 1))))} />
      </div>

      {f.fuel && f.body && (
        <div className="space-y-2 rounded-lg border border-line bg-bg-2/50 p-3">
          <p className="text-xs leading-relaxed text-muted">
            No sourced efficiency figure exists for this cab, and MissionEV won&apos;t invent one. Choose how to estimate it ({unit}):
          </p>
          <div role="radiogroup" aria-label="Efficiency estimate" className="grid gap-2 sm:grid-cols-2">
            {([["default", "Use the category default"], ["estimate", "Enter my estimate"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={f.fallback === id} disabled={disabled} onClick={() => set("fallback", id)} className={cn("min-h-10 rounded-lg border px-3 py-2 text-left font-mono text-[11px] tracking-[0.06em] uppercase transition disabled:opacity-60", f.fallback === id ? "border-lime/50 bg-lime/[0.1] text-lime" : "border-line bg-bg-2 text-muted hover:text-fg")}>
                {label}
              </button>
            ))}
          </div>
          {f.fallback === "estimate" && <TextField label={`Your estimate (${unit})`} mono inputMode="decimal" autoComplete="off" value={f.estimate} disabled={disabled} error={res.errors.estimate} onChange={(e) => set("estimate", e.target.value)} />}
          {res.vehicle && <p className="text-xs text-muted">Using <span className="font-mono text-fg">{res.vehicle.spec.efficiencySource === "category-default" ? "category default" : "your estimate"}</span> · confidence <Badge tone={confTone[res.vehicle.spec.confidence]}>{res.vehicle.spec.confidence}</Badge></p>}
        </div>
      )}

      {conf && (
        <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          OCR confidence:
          <Badge tone={confTone[conf.provider as keyof typeof confTone]}>provider {conf.provider}</Badge>
          <Badge tone={confTone[conf.distance as keyof typeof confTone]}>distance {conf.distance}</Badge>
          <Badge tone={confTone[conf.vehicle as keyof typeof confTone]}>vehicle {conf.vehicle}</Badge>
        </p>
      )}

      <label className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm", f.confirmed ? "border-ok/40 bg-ok/[0.06]" : "border-line")}>
        <input type="checkbox" checked={f.confirmed} disabled={disabled || !res.vehicle} onChange={(e) => setRide({ confirmed: e.target.checked })} className="mt-0.5 size-4 accent-[var(--color-lime)]" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-fg">
            {f.confirmed ? <CheckCircle2 aria-hidden className="size-4 text-ok" /> : <FileText aria-hidden className="size-4 text-muted" />} These details are right
          </span>
          <span className="block text-xs leading-relaxed text-muted">I confirm the provider, distance, vehicle and fuel above. Editing anything clears this.</span>
        </span>
      </label>
      {selection.blocked && !f.confirmed && <p className="text-xs text-warn">{selection.blocked}</p>}
    </div>
  );
}
