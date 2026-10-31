"use client";

import { useMemo, useState } from "react";
import { Bike, Bus, Car, CarTaxiFront, CircleHelp, Footprints, Pencil, Plus, Save, Trash2, TrainFront, Zap } from "lucide-react";
import { SelectField, TextField } from "@/components/ui/fields";
import { Alert, Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { useIntegrationStatus } from "@/lib/api/client";
import { cn } from "@/lib/format";
import {
  EMPTY_DRAFT,
  MODE_INFO,
  PROFILE_MODES,
  VEHICLE_MODES,
  emptyProfile,
  resolveDraft,
  vehicleLabel,
  type ProfileModeId,
  type RegisteredVehicle,
  type TransportProfile,
  type VehicleDraft,
  type VehicleModeId,
} from "@/lib/transport/profile";
import type { RegistrationRecord } from "@/providers/onboarding-provider";
import { VehicleForm } from "./vehicle-form";

const ICON: Record<ProfileModeId, React.ReactNode> = {
  private_ev_car: <Zap className="size-5" />,
  private_ev_2w: <Zap className="size-5" />,
  private_petrol_car: <Car className="size-5" />,
  private_diesel_car: <Car className="size-5" />,
  private_ice_2w: <Bike className="size-5" />,
  ride_hail: <CarTaxiFront className="size-5" />,
  metro: <TrainFront className="size-5" />,
  ebus: <Bus className="size-5" />,
  active: <Footprints className="size-5" />,
  other: <CircleHelp className="size-5" />,
};

const ACTIVE_OPTIONS = { walking: "Walking", cycling: "Cycling", both: "Walking and cycling" } as const;
const isVehicleMode = (m: ProfileModeId): m is VehicleModeId => (VEHICLE_MODES as readonly string[]).includes(m);

const confidenceTone = { high: "ok", medium: "cyan", low: "warn" } as const;

function efficiencyText(v: RegisteredVehicle) {
  return v.fuelType === "electric" ? `${(v.consumptionKWhPer100Km ?? 0).toFixed(1)} kWh/100 km` : `${v.mileageKmPerLitre} km/l`;
}

export function TransportPanel({
  account,
  saved,
  onSave,
}: {
  account: RegistrationRecord | null;
  saved: TransportProfile | null;
  onSave: (profile: TransportProfile) => void;
}) {
  const locked = !account;
  const { status } = useIntegrationStatus();
  /** Edits are layered over the saved profile: null means "show what is saved". */
  const [edit, setEdit] = useState<TransportProfile | null>(null);
  const [draft, setDraft] = useState<VehicleDraft | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const profile = useMemo(() => edit ?? saved ?? emptyProfile(account?.userId ?? ""), [edit, saved, account]);
  const isSaved = saved !== null && edit === null;
  const result = useMemo(() => (draft ? resolveDraft(draft) : null), [draft]);
  const selected = new Set(profile.preferredModes);

  const update = (patch: Partial<TransportProfile>) => setEdit({ ...profile, ...patch });
  const vehiclesOf = (m: VehicleModeId) => profile.registeredVehicles.filter((v) => v.mode === m);

  const toggleMode = (m: ProfileModeId) => {
    if (selected.has(m)) {
      if (isVehicleMode(m) && vehiclesOf(m).length) return; // remove its vehicles first
      update({ preferredModes: profile.preferredModes.filter((x) => x !== m) });
      if (draft?.mode === m) setDraft(null);
    } else {
      update({ preferredModes: [...profile.preferredModes, m] });
    }
  };

  const openForm = (m: VehicleModeId, existing?: RegisteredVehicle) => {
    setShowErrors(false);
    setDraft(
      existing
        ? {
            ...EMPTY_DRAFT,
            id: existing.id,
            mode: existing.mode,
            manufacturer: existing.manufacturer,
            model: existing.model,
            variant: existing.variant ?? "",
            year: existing.manufacturingYear ? String(existing.manufacturingYear) : "",
            isSuv: Boolean(existing.isSuv),
            mileage: existing.fuelType !== "electric" && existing.efficiencySource === "user-entered" ? String(existing.mileageKmPerLitre ?? "") : "",
            battery: existing.usableBatteryCapacityKWh ? String(existing.usableBatteryCapacityKWh) : "",
            range: existing.fullChargeRangeKm ? String(existing.fullChargeRangeKm) : "",
            evMethod: existing.efficiencySource === "user-kwh-per-100km" ? "efficiency" : "range",
            efficiency: existing.efficiencySource === "user-kwh-per-100km" ? String(Math.round((existing.consumptionKWhPer100Km ?? 0) * 100) / 100) : "",
            efficiencyBasis: existing.consumptionBasis ?? "battery",
            unknown: existing.efficiencySource === "category-default" || existing.efficiencySource === "catalog" || (existing.efficiencySource === "user-entered" && existing.confidence === "low"),
            fallback: existing.efficiencySource === "category-default" ? "default" : "estimate",
          }
        : { ...EMPTY_DRAFT, mode: m },
    );
  };

  const saveVehicle = () => {
    if (!draft || !result) return;
    setShowErrors(true);
    if (!result.vehicle) return;
    const v: RegisteredVehicle = { ...result.vehicle, id: draft.id ?? `veh_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}` };
    const others = profile.registeredVehicles.filter((x) => x.id !== v.id);
    update({ registeredVehicles: [...others, v] });
    setDraft(null);
    setShowErrors(false);
  };

  const removeVehicle = (id: string) => update({ registeredVehicles: profile.registeredVehicles.filter((v) => v.id !== id) });

  const save = () => {
    onSave({ ...profile, userId: account?.userId ?? profile.userId, updatedAt: Date.now() });
    setEdit(null);
    setDraft(null);
  };

  return (
    <Panel aria-labelledby="transport-title" className={cn(locked && "opacity-70")}>
      <PanelHeader
        id="transport-title"
        eyebrow="Step 2 · Transport profile"
        title="How do you usually commute?"
        subtitle="Add the vehicles or transportation modes you regularly use. You can choose a different mode for every journey."
        action={isSaved ? <Badge tone="ok" dot>Saved</Badge> : locked ? <Badge dot>Sign in first</Badge> : undefined}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <fieldset disabled={locked} className="min-w-0 space-y-6 border-0 p-0">
          <legend className="sr-only">Transport modes you regularly use</legend>

          <div role="group" aria-label="Modes you regularly use" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {PROFILE_MODES.map((m) => {
              const on = selected.has(m);
              const pinned = isVehicleMode(m) && on && vehiclesOf(m).length > 0;
              return (
                <button
                  key={m}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-describedby={pinned ? `${m}-pinned` : undefined}
                  onClick={() => toggleMode(m)}
                  className={cn(
                    "flex min-w-0 items-start gap-3 rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed",
                    on ? "border-lime/50 bg-lime/[0.08]" : "border-line bg-bg-2 hover:border-line-strong",
                    pinned && "cursor-not-allowed",
                  )}
                >
                  <span aria-hidden className={cn("mt-0.5 shrink-0", on ? "text-lime" : "text-muted")}>
                    {ICON[m]}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", on ? "text-fg" : "text-muted")}>{MODE_INFO[m].label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{MODE_INFO[m].note}</span>
                    {pinned && (
                      <span id={`${m}-pinned`} className="mt-1 block text-[11px] text-warn">
                        Remove its saved vehicles to deselect.
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {profile.preferredModes.filter(isVehicleMode).map((m) => (
            <section key={m} aria-label={MODE_INFO[m].label} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold tracking-[0.06em] text-fg uppercase">
                  <span aria-hidden className="text-lime">{ICON[m]}</span> {MODE_INFO[m].label}
                </h3>
                {draft?.mode !== m && (
                  <Button size="sm" variant="secondary" icon={<Plus aria-hidden className="size-3.5" />} onClick={() => openForm(m)}>
                    Add vehicle
                  </Button>
                )}
              </div>

              {vehiclesOf(m).length === 0 && draft?.mode !== m && <p className="text-xs text-muted">No vehicle added yet. Add one to record journeys in it.</p>}

              <ul className="space-y-2">
                {vehiclesOf(m).map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg-2/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{vehicleLabel(v)}</p>
                      <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">
                        <span className="font-mono text-fg">{efficiencyText(v)}</span> · {v.efficiencyNote}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={confidenceTone[v.confidence]}>{v.confidence} confidence</Badge>
                      <Button size="sm" variant="ghost" aria-label={`Edit ${vehicleLabel(v)}`} icon={<Pencil aria-hidden className="size-3.5" />} onClick={() => openForm(m, v)} />
                      <Button size="sm" variant="ghost" aria-label={`Remove ${vehicleLabel(v)}`} icon={<Trash2 aria-hidden className="size-3.5" />} onClick={() => removeVehicle(v.id)} />
                    </div>
                  </li>
                ))}
              </ul>

              {draft && result && draft.mode === m && (
                <VehicleForm
                  draft={draft}
                  result={result}
                  showErrors={showErrors}
                  editing={Boolean(draft.id)}
                  onChange={(patch) => setDraft({ ...draft, ...patch })}
                  onSave={saveVehicle}
                  onCancel={() => {
                    setDraft(null);
                    setShowErrors(false);
                  }}
                />
              )}
            </section>
          ))}

          {selected.has("ride_hail") && (
            <Alert tone="cyan" title="Ola / Uber / Rapido">
              Nothing to set up here. For each ride you&apos;ll upload the receipt on Capture Trip; the vehicle that carried you decides the result.{" "}
              {status?.ocr.configured
                ? "Receipt reading (Azure AI Vision) is configured on this server."
                : "Receipt reading (Azure AI Vision) isn't configured on this server, so you'll enter the receipt details by hand. Nothing is read automatically."}
            </Alert>
          )}

          {selected.has("metro") && (
            <TextField label="Metro network (optional)" autoComplete="off" placeholder="e.g. Delhi Metro" suggestions={["Delhi Metro", "Mumbai Metro", "Namma Metro", "Kolkata Metro", "Chennai Metro", "Hyderabad Metro"]} value={profile.metroNetwork ?? ""} onChange={(e) => update({ metroNetwork: e.target.value })} />
          )}
          {selected.has("ebus") && <TextField label="Operator or route (optional)" autoComplete="off" placeholder="e.g. DTC electric bus" value={profile.ebusOperator ?? ""} onChange={(e) => update({ ebusOperator: e.target.value })} />}
          {selected.has("active") && (
            <SelectField
              label="Activity"
              placeholder="Walking, cycling or both"
              options={Object.values(ACTIVE_OPTIONS)}
              value={profile.activeKind ? ACTIVE_OPTIONS[profile.activeKind] : ""}
              hint="Journey distance is measured by GPS; walking and cycling count as zero emissions at the point of energy use."
              onChange={(e) => update({ activeKind: (Object.keys(ACTIVE_OPTIONS) as Array<keyof typeof ACTIVE_OPTIONS>).find((k) => ACTIVE_OPTIONS[k] === e.target.value) })}
            />
          )}
          {selected.has("other") && (
            <Alert tone="warn" title="Unsupported transport">
              Auto-rickshaws, trains and shared vans can&apos;t be calculated or rewarded yet. Journeys in them can&apos;t be recorded for now.
            </Alert>
          )}

          <Alert tone="neutral" title="Owning a vehicle earns nothing by itself">
            Every journey asks how you travelled. An EV owner who takes a petrol cab, or someone with no vehicle who takes the metro, is calculated from that journey alone.
          </Alert>

          <Button variant="primary" size="lg" className="w-full sm:w-auto" icon={<Save aria-hidden className="size-4" />} onClick={save} disabled={locked || Boolean(draft)}>
            {isSaved ? "Update transport profile" : "Save transport profile"}
          </Button>
          {draft && <p className="-mt-3 text-xs text-muted">Save or cancel the open vehicle form first.</p>}
        </fieldset>
      </div>
    </Panel>
  );
}
