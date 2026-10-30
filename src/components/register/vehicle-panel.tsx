"use client";

import { useState } from "react";
import { ChevronDown, Info, ScanSearch } from "lucide-react";
import { SelectField, TextField } from "@/components/ui/fields";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { DEMO_RULES, type RegistryFailureCode, type RegistryRecord } from "@/lib/vahan";
import {
  FUEL_TYPES,
  MANUFACTURER_SUGGESTIONS,
  PURCHASE_YEARS,
  VEHICLE_CATEGORIES,
  type VehicleErrors,
  type VehicleForm,
} from "@/lib/vehicle";
import { VahanFailure, VahanLoading, VahanSuccess } from "./vahan-result";

export type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; record: RegistryRecord }
  | { status: "failure"; code: RegistryFailureCode; message: string };

export function VehiclePanel({
  form,
  errors,
  showAllErrors,
  lookup,
  onChange,
  onBlurField,
  onVerify,
}: {
  form: VehicleForm;
  errors: VehicleErrors;
  showAllErrors: boolean;
  lookup: LookupState;
  onChange: <K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) => void;
  onBlurField: (key: keyof VehicleForm) => void;
  onVerify: () => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const loading = lookup.status === "loading";
  const suggestions = form.category ? MANUFACTURER_SUGGESTIONS[form.category] : undefined;
  const err = (k: keyof VehicleForm) => errors[k];

  return (
    <Panel aria-labelledby="vehicle-title">
      <PanelHeader
        id="vehicle-title"
        eyebrow="Step 2 · Vehicle"
        title="Register your vehicle"
        subtitle="Link your vehicle identity to your MissionEV profile."
        action={
          <Badge tone="warn" dot>
            Vahan registry · demo
          </Badge>
        }
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onVerify();
        }}
        className="space-y-5 p-4 sm:p-6"
        aria-describedby={showAllErrors && Object.keys(errors).length ? "vehicle-form-summary" : undefined}
      >
        {showAllErrors && Object.keys(errors).length > 0 && (
          <p id="vehicle-form-summary" role="alert" className="rounded-lg border border-err/35 bg-err/[0.06] px-3 py-2 text-sm text-err">
            Fix {Object.keys(errors).length} highlighted {Object.keys(errors).length === 1 ? "field" : "fields"} before verifying.
          </p>
        )}

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          <TextField
            className="sm:col-span-2"
            label="Vehicle registration number"
            required
            mono
            placeholder="DL 01 AB 1234"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            value={form.regNumber}
            error={err("regNumber")}
            hint="Stored masked only — the full number never leaves this tab."
            onChange={(e) => onChange("regNumber", e.target.value)}
            onBlur={() => onBlurField("regNumber")}
          />
          <SelectField
            label="Vehicle category"
            required
            placeholder="Select category"
            options={VEHICLE_CATEGORIES}
            value={form.category}
            error={err("category")}
            onChange={(e) => onChange("category", e.target.value as VehicleForm["category"])}
            onBlur={() => onBlurField("category")}
          />
          <SelectField
            label="Fuel / power type"
            required
            placeholder="Select fuel / power"
            options={FUEL_TYPES}
            value={form.fuel}
            error={err("fuel")}
            onChange={(e) => onChange("fuel", e.target.value as VehicleForm["fuel"])}
            onBlur={() => onBlurField("fuel")}
          />
          <TextField
            label="Manufacturer"
            required
            placeholder="e.g. Tata"
            autoComplete="off"
            suggestions={suggestions}
            value={form.manufacturer}
            error={err("manufacturer")}
            onChange={(e) => onChange("manufacturer", e.target.value)}
            onBlur={() => onBlurField("manufacturer")}
          />
          <TextField
            label="Model"
            required
            placeholder="e.g. Nexon EV"
            autoComplete="off"
            value={form.model}
            error={err("model")}
            onChange={(e) => onChange("model", e.target.value)}
            onBlur={() => onBlurField("model")}
          />
          <SelectField
            label="Approximate purchase year"
            required
            placeholder="Select year"
            options={PURCHASE_YEARS}
            value={form.year}
            error={err("year")}
            onChange={(e) => onChange("year", e.target.value)}
            onBlur={() => onBlurField("year")}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" variant="primary" size="lg" loading={loading} icon={<ScanSearch aria-hidden className="size-4" />} className="w-full sm:w-auto">
            {loading ? "Verifying…" : lookup.status === "success" ? "Re-verify with Vahan" : "Verify with Vahan"}
          </Button>
          <p className="text-xs text-muted">
            <span className="font-mono text-warn">DEMO REGISTRY</span> — deterministic mock; no live Vahan API is called.
          </p>
        </div>

        <div aria-live="polite" className="space-y-3">
          {lookup.status === "loading" && <VahanLoading />}
          {lookup.status === "success" && <VahanSuccess record={lookup.record} />}
          {lookup.status === "failure" && <VahanFailure code={lookup.code} message={lookup.message} onRetry={onVerify} />}
        </div>

        <div className="rounded-xl border border-line bg-bg-2/50">
          <button
            type="button"
            onClick={() => setRulesOpen((o) => !o)}
            aria-expanded={rulesOpen}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-muted hover:text-fg"
          >
            <Info aria-hidden className="size-4 shrink-0 text-cyan" />
            <span className="flex-1">Demo registry test cases</span>
            <ChevronDown aria-hidden className={cn("size-4 transition", rulesOpen && "rotate-180")} />
          </button>
          {rulesOpen && (
            <ul className="space-y-1.5 border-t border-line px-3 py-3 text-xs text-muted">
              <li>Any other valid registration returns a verified, active RC.</li>
              {DEMO_RULES.map((r) => (
                <li key={r.suffix}>
                  Number ending <span className="font-mono text-fg">{r.suffix}</span> → {r.outcome}
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </Panel>
  );
}
