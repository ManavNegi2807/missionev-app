"use client";

import { Calculator, Info, Save, X } from "lucide-react";
import { TextField } from "@/components/ui/fields";
import { Badge, Button } from "@/components/ui/primitives";
import { CATEGORY_DEFAULTS } from "@/lib/carbon/emissionFactors";
import { cn } from "@/lib/format";
import { manufacturersFor, modelsFor } from "@/lib/transport/catalog";
import { MODE_INFO, bodyOfMode, powertrainsOfMode, type DraftResult, type VehicleDraft, type VehicleModeId } from "@/lib/transport/profile";

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-10 rounded-lg border px-3 py-2 text-left font-mono text-[11px] leading-snug tracking-[0.06em] uppercase transition",
              on ? "border-lime/50 bg-lime/[0.1] text-lime" : "border-line bg-bg-2 text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const LinkButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="mt-1.5 text-left text-xs text-cyan underline-offset-2 hover:underline">
    {children}
  </button>
);

export function VehicleForm({
  draft,
  result,
  showErrors,
  editing,
  onChange,
  onSave,
  onCancel,
}: {
  draft: VehicleDraft;
  result: DraftResult;
  showErrors: boolean;
  editing: boolean;
  onChange: (patch: Partial<VehicleDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const mode = draft.mode as VehicleModeId;
  const body = bodyOfMode(mode);
  const powertrain = powertrainsOfMode(mode)[0];
  const ev = powertrain === "electric";
  const err = (k: keyof VehicleDraft) => (showErrors ? result.errors[k] : undefined);
  const unit = ev ? "kWh/100 km" : "km/l";
  const catEff = result.match?.efficiency;
  const catalogHasFigure = Boolean(catEff && (catEff.mileageKmPerUnit || catEff.kWhPer100Km || (catEff.usableBatteryKWh && catEff.rangeKm)));
  const categoryDefault = ev ? `${(CATEGORY_DEFAULTS.electric[body] * 100).toFixed(1)} kWh/100 km` : `${CATEGORY_DEFAULTS[powertrain === "diesel" ? "diesel" : "petrol"][body]} km/l`;

  const lookup = (
    <div className="space-y-3 rounded-xl border border-line bg-bg-2/50 p-3.5">
      <p className="text-sm font-medium text-fg">{ev ? "No figures to hand? Use a model look-up or an estimate." : "Don't know your mileage? Use a model look-up or an estimate."}</p>
      {catalogHasFigure ? (
        <p className="text-xs leading-relaxed text-muted">
          <span className="text-ok">Found in the model list:</span> {result.match!.manufacturer} {result.match!.model}. Figure from {catEff!.source} ({catEff!.year}).
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-muted">
            {result.match
              ? `“${result.match.manufacturer} ${result.match.model}” is in the model list, but the list has no sourced efficiency figure for it. MissionEV never makes up a manufacturer figure.`
              : "That model isn't in the model list, and the list has no efficiency figures to match against anyway."}{" "}
            Choose how to continue:
          </p>
          <Seg
            label="How to continue without your own figure"
            value={draft.fallback}
            onChange={(fallback) => onChange({ fallback })}
            options={[
              { id: "estimate", label: "Enter my best estimate" },
              { id: "default", label: `Use the category default (${categoryDefault})` },
            ]}
          />
          {draft.fallback === "estimate" ? (
            <TextField
              label={`Your estimate (${unit})`}
              mono
              inputMode="decimal"
              autoComplete="off"
              placeholder={ev ? "e.g. 14" : "e.g. 16"}
              value={draft.estimate}
              error={err("estimate")}
              hint="Recorded as an estimate with low confidence."
              onChange={(e) => onChange({ estimate: e.target.value })}
            />
          ) : (
            <p className="text-xs leading-relaxed text-warn">
              The category default is not your {body === "car" ? "car's" : "bike's"} own figure. Results will be labelled low confidence, and you can replace it at any time.
            </p>
          )}
        </>
      )}
      <LinkButton onClick={() => onChange({ unknown: false })}>I do know my figures — enter them instead</LinkButton>
    </div>
  );

  return (
    <div className="space-y-5 rounded-xl border border-lime/25 bg-lime/[0.03] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">{editing ? "Edit vehicle" : "Add vehicle"}</p>
          <h3 className="text-sm font-semibold tracking-[0.06em] text-fg uppercase">{MODE_INFO[mode].label}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} icon={<X aria-hidden className="size-3.5" />} aria-label="Close the vehicle form">
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <TextField label="Manufacturer" required autoComplete="off" placeholder={ev ? "e.g. Tata" : "e.g. Maruti Suzuki"} suggestions={manufacturersFor(body, powertrain)} value={draft.manufacturer} error={err("manufacturer")} onChange={(e) => onChange({ manufacturer: e.target.value })} />
        <TextField label="Model" required autoComplete="off" placeholder={ev ? "e.g. Nexon EV" : "e.g. Swift"} suggestions={modelsFor(body, powertrain, draft.manufacturer)} value={draft.model} error={err("model")} onChange={(e) => onChange({ model: e.target.value })} />
        <TextField label="Variant (optional)" autoComplete="off" placeholder="e.g. ZXi, Max, Long Range" value={draft.variant} onChange={(e) => onChange({ variant: e.target.value })} />
        <TextField label="Manufacturing year (optional)" mono inputMode="numeric" autoComplete="off" placeholder="e.g. 2022" value={draft.year} error={err("year")} onChange={(e) => onChange({ year: e.target.value })} />
      </div>

      {body === "car" && !ev && (
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={draft.isSuv} onChange={(e) => onChange({ isSuv: e.target.checked })} className="mt-0.5 size-4 accent-[var(--color-lime)]" />
          <span>
            SUV / MUV body <span className="block text-xs">Only used to pick the matching contract mode (ICE_SUV); it doesn&apos;t change your emissions.</span>
          </span>
        </label>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{ev ? "Electric" : powertrain}</Badge>
          <span className="text-xs text-muted">{ev ? "Electric vehicles use kWh, not km/l." : `Fuel type is fixed by the vehicle kind (${powertrain}).`}</span>
        </div>

        {draft.unknown ? (
          lookup
        ) : !ev ? (
          <div>
            <TextField
              label="Vehicle mileage (km/l)"
              required
              mono
              inputMode="decimal"
              autoComplete="off"
              placeholder={body === "car" ? "e.g. 18" : "e.g. 45"}
              value={draft.mileage}
              error={err("mileage")}
              hint="Your real-world figure, not the brochure one."
              onChange={(e) => onChange({ mileage: e.target.value })}
            />
            <LinkButton onClick={() => onChange({ unknown: true })}>Don&apos;t know your mileage?</LinkButton>
          </div>
        ) : (
          <div className="space-y-4">
            <Seg
              label="How do you want to describe your EV's efficiency?"
              value={draft.evMethod}
              onChange={(evMethod) => onChange({ evMethod })}
              options={[
                { id: "range", label: "Battery capacity + range" },
                { id: "efficiency", label: "Energy efficiency" },
              ]}
            />
            {draft.evMethod === "range" ? (
              <div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <TextField label="Usable battery capacity (kWh)" required mono inputMode="decimal" autoComplete="off" placeholder="e.g. 40.5" value={draft.battery} error={err("battery")} hint="Usable, not gross, capacity if you know both." onChange={(e) => onChange({ battery: e.target.value })} />
                  <TextField label="Real-world range, full charge (km)" required mono inputMode="decimal" autoComplete="off" placeholder="e.g. 325" value={draft.range} error={err("range")} hint="What you actually get, not the rated figure." onChange={(e) => onChange({ range: e.target.value })} />
                </div>
                <LinkButton onClick={() => onChange({ unknown: true })}>Don&apos;t know battery capacity?</LinkButton>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <TextField label={`Energy consumption (${draft.efficiencyUnit})`} required mono inputMode="decimal" autoComplete="off" placeholder={draft.efficiencyUnit === "kWh/100km" ? "e.g. 14" : "e.g. 7"} value={draft.efficiency} error={err("efficiency")} onChange={(e) => onChange({ efficiency: e.target.value })} />
                  <div className="min-w-0">
                    <p className="section-label mb-1.5">Unit</p>
                    <Seg label="Consumption unit" value={draft.efficiencyUnit} onChange={(efficiencyUnit) => onChange({ efficiencyUnit })} options={[{ id: "kWh/100km", label: "kWh/100 km" }, { id: "km/kWh", label: "km/kWh" }]} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="section-label mb-1.5">This figure is…</p>
                  <Seg label="What the figure measures" value={draft.efficiencyBasis} onChange={(efficiencyBasis) => onChange({ efficiencyBasis })} options={[{ id: "battery", label: "Battery-side (dashboard)" }, { id: "wall", label: "From the charger (wall)" }]} />
                  <p className="mt-1.5 text-xs text-muted">Battery-side figures are increased by an assumed charging loss before the grid&apos;s emissions are applied; charger-side figures are not.</p>
                </div>
                <LinkButton onClick={() => onChange({ unknown: true })}>Don&apos;t know energy consumption?</LinkButton>
              </div>
            )}
          </div>
        )}

        {ev && result.derived && (
          <div className="rounded-xl border border-cyan/25 bg-cyan/[0.04] p-3.5">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-cyan">
              <Calculator aria-hidden className="size-3.5" /> CALCULATED FROM YOUR INPUT
            </p>
            <dl className="mt-2 grid grid-cols-3 gap-3 font-mono text-sm text-fg">
              <div>
                <dt className="section-label">kWh/km</dt>
                <dd>{result.derived.kWhPerKm.toFixed(4)}</dd>
              </div>
              <div>
                <dt className="section-label">kWh/100 km</dt>
                <dd>{result.derived.kWhPer100Km.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="section-label">km/kWh</dt>
                <dd>{result.derived.kmPerKWh.toFixed(2)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {result.derived.formula}. This is an estimate: real consumption changes with driving style, load, temperature and charging losses, and a rated range is not a real-world range.
            </p>
          </div>
        )}
      </div>

      <TextField
        label="Registration number (optional)"
        mono
        autoComplete="off"
        placeholder="DL 3C AB 1234"
        value={draft.registration}
        hint="Not needed for any calculation. Only a masked form (state code and last four characters) is kept."
        onChange={(e) => onChange({ registration: e.target.value })}
      />

      {!ev && (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-bg-2/50 px-3.5 py-3 text-xs leading-relaxed text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-cyan" />
          <p>{`${powertrain === "diesel" ? "Diesel" : "Petrol"} journeys are measured for your footprint but earn no $MEV. Registering the vehicle never earns credit by itself.`}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="md" icon={<Save aria-hidden className="size-4" />} onClick={onSave}>
          {editing ? "Update vehicle" : "Save vehicle"}
        </Button>
        <Button variant="ghost" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
