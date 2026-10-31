import { CATEGORY_DEFAULTS } from "@/lib/carbon/emissionFactors";
import {
  categoryDefaultSpec,
  confidenceOf,
  evConsumptionFromKmPerKWh,
  evConsumptionFromPer100Km,
  evConsumptionFromRange,
  validateConsumption,
  validateEvInputs,
  validateMileage,
} from "@/lib/carbon/efficiency";
import type { Confidence, ConsumptionBasis, EfficiencySource, JourneyMode, Powertrain, VehicleBody, VehicleEnergySpec } from "@/lib/carbon/types";
import { findEntry, type CatalogEntry } from "./catalog";

/** The commuter's saved transport profile (D1). It describes what they use; each journey chooses its own mode separately. */

export const VEHICLE_MODES = ["private_ev_car", "private_ev_2w", "private_petrol_car", "private_diesel_car", "private_ice_2w"] as const;
export type VehicleModeId = (typeof VEHICLE_MODES)[number];
export const PROFILE_MODES = [...VEHICLE_MODES, "ride_hail", "metro", "ebus", "active", "other"] as const;
export type ProfileModeId = (typeof PROFILE_MODES)[number];

export const MODE_INFO: Record<ProfileModeId, { label: string; note: string }> = {
  private_ev_car: { label: "Private electric car", note: "Charging emissions are counted from your car's energy use." },
  private_ev_2w: { label: "Private electric two-wheeler", note: "Compared with a petrol two-wheeler." },
  private_petrol_car: { label: "Private petrol car", note: "Measured for your footprint; petrol trips earn no $MEV." },
  private_diesel_car: { label: "Private diesel car", note: "Measured for your footprint; diesel trips earn no $MEV." },
  private_ice_2w: { label: "Private petrol two-wheeler", note: "Measured for your footprint; not recordable on-chain yet." },
  ride_hail: { label: "Ola / Uber / Rapido", note: "Upload the ride receipt for each journey; the vehicle that carried you decides the result." },
  metro: { label: "Metro", note: "No vehicle needed. Counted per passenger-km." },
  ebus: { label: "Electric bus", note: "No vehicle needed. Counted per passenger-km." },
  active: { label: "Walking / cycling", note: "No vehicle needed. Zero emissions at the point of energy use." },
  other: { label: "Other or unsupported transport", note: "Auto-rickshaws, trains, shared vans… can't be calculated or rewarded yet." },
};

export interface RegisteredVehicle {
  id: string;
  mode: VehicleModeId;
  manufacturer: string;
  model: string;
  variant?: string;
  manufacturingYear?: number;
  isSuv?: boolean;
  fuelType: Powertrain;
  /** ICE: real-world km per litre. */
  mileageKmPerLitre?: number;
  /** EV inputs, as the commuter gave them. The resolved kWh/100 km is always present for an EV. */
  usableBatteryCapacityKWh?: number;
  fullChargeRangeKm?: number;
  consumptionKWhPer100Km?: number;
  consumptionBasis?: ConsumptionBasis;
  efficiencySource: EfficiencySource;
  /** Where the figure came from, in words, for the "how was this calculated" panel. */
  efficiencyNote: string;
  confidence: Confidence;
  /** Optional, masked ("DL ••••• 1234"); the full number is never stored. */
  registrationNumber?: string;
}

export interface TransportProfile {
  userId: string;
  preferredModes: ProfileModeId[];
  registeredVehicles: RegisteredVehicle[];
  metroNetwork?: string;
  ebusOperator?: string;
  activeKind?: "walking" | "cycling" | "both";
  updatedAt: number;
}

/** `updatedAt` is 0 until saved: reading the clock while rendering would freeze it into the prerendered page. */
export const emptyProfile = (userId: string): TransportProfile => ({ userId, preferredModes: [], registeredVehicles: [], updatedAt: 0 });

export const bodyOfMode = (m: VehicleModeId): VehicleBody => (m === "private_ev_2w" || m === "private_ice_2w" ? "two_wheeler" : "car");
export const powertrainsOfMode = (m: VehicleModeId): Powertrain[] =>
  m === "private_ev_car" || m === "private_ev_2w" ? ["electric"] : m === "private_petrol_car" ? ["petrol"] : m === "private_diesel_car" ? ["diesel"] : ["petrol"];

export const vehicleLabel = (v: Pick<RegisteredVehicle, "manufacturer" | "model" | "variant">) => [v.manufacturer, v.model, v.variant].filter(Boolean).join(" ");

/** A saved vehicle reduced to what the carbon engine needs. */
export function vehicleSpecOf(v: RegisteredVehicle): VehicleEnergySpec {
  const body = bodyOfMode(v.mode);
  const common = { body, powertrain: v.fuelType, isSuv: v.isSuv, efficiencySource: v.efficiencySource, confidence: v.confidence, label: vehicleLabel(v) };
  if (v.fuelType === "electric") {
    const per100 = v.consumptionKWhPer100Km ?? (v.usableBatteryCapacityKWh && v.fullChargeRangeKm ? (v.usableBatteryCapacityKWh / v.fullChargeRangeKm) * 100 : undefined);
    return { ...common, consumptionKWhPerKm: per100 !== undefined ? per100 / 100 : CATEGORY_DEFAULTS.electric[body], consumptionBasis: v.consumptionBasis ?? "battery" };
  }
  return { ...common, mileageKmPerUnit: v.mileageKmPerLitre ?? CATEGORY_DEFAULTS[v.fuelType][body] };
}

/** Which saved vehicles can be used for a private journey of this mode. Public transport and ride-hail need none. */
export const vehiclesForJourney = (profile: TransportProfile | null, mode: JourneyMode): RegisteredVehicle[] =>
  profile?.registeredVehicles.filter((v) => v.mode === mode) ?? [];

/** "DL 3C AB 1234" → "DL ••••• 1234": enough to recognise, not enough to identify the vehicle. */
export function maskRegistration(raw: string): string | undefined {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length < 6) return undefined;
  return `${s.slice(0, 2)} ••••• ${s.slice(-4)}`;
}

/* ------------------------------------------------------------------------------------------- registration form */

export type Fallback = "estimate" | "default";

export interface VehicleDraft {
  id?: string;
  mode: VehicleModeId | "";
  manufacturer: string;
  model: string;
  variant: string;
  year: string;
  isSuv: boolean;
  /** ICE */
  mileage: string;
  /** EV */
  evMethod: "range" | "efficiency";
  battery: string;
  range: string;
  efficiency: string;
  efficiencyUnit: "kWh/100km" | "km/kWh";
  efficiencyBasis: ConsumptionBasis;
  /** "Don't know your figures?": use the catalogue, else an estimate or a labelled category default. */
  unknown: boolean;
  fallback: Fallback;
  estimate: string;
  registration: string;
}

export const EMPTY_DRAFT: VehicleDraft = {
  mode: "", manufacturer: "", model: "", variant: "", year: "", isSuv: false, mileage: "",
  evMethod: "range", battery: "", range: "", efficiency: "", efficiencyUnit: "kWh/100km", efficiencyBasis: "battery",
  unknown: false, fallback: "estimate", estimate: "", registration: "",
};

export type DraftErrors = Partial<Record<keyof VehicleDraft, string>>;

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const isEv = (m: VehicleDraft["mode"]) => m === "private_ev_car" || m === "private_ev_2w";

export interface DraftResult {
  errors: DraftErrors;
  vehicle: Omit<RegisteredVehicle, "id"> | null;
  /** For EVs: the derived figures to show the commuter as they type. */
  derived: { kWhPerKm: number; kWhPer100Km: number; kmPerKWh: number; formula: string } | null;
  /** The catalogue entry the model matched, if any. */
  match: CatalogEntry | null;
}

/**
 * Turns the form into a saved vehicle, or the errors that stop it. The efficiency is resolved in a fixed order so the
 * stored `efficiencySource` is always the truth: the commuter's own figure, then a catalogue figure (only if one has been
 * added with a source), then their estimate, then a labelled category default.
 */
export function resolveDraft(d: VehicleDraft, catalog?: readonly CatalogEntry[]): DraftResult {
  const errors: DraftErrors = {};
  if (!d.mode) return { errors: { mode: "Choose the kind of vehicle." }, vehicle: null, derived: null, match: null };
  const mode: VehicleModeId = d.mode;
  const body = bodyOfMode(mode);
  const powertrain = powertrainsOfMode(mode)[0];

  if (d.manufacturer.trim().length < 2) errors.manufacturer = "Enter the manufacturer, e.g. Maruti Suzuki.";
  if (d.model.trim().length < 2) errors.model = "Enter the model, e.g. Swift.";
  if (d.model.trim().length > 40) errors.model = "Keep the model name under 40 characters.";
  const year = num(d.year);
  if (year !== undefined && (!Number.isInteger(year) || year < 1990 || year > new Date().getFullYear() + 1)) errors.year = "Enter a four-digit year, or leave it blank.";

  const match = findEntry({ manufacturer: d.manufacturer, model: d.model, body, powertrain }, catalog);
  const cat = match?.efficiency;
  const base = {
    mode, manufacturer: d.manufacturer.trim(), model: d.model.trim().replace(/\s+/g, " "), variant: d.variant.trim() || undefined,
    manufacturingYear: year, isSuv: d.isSuv || match?.isSuv || undefined, fuelType: powertrain, registrationNumber: d.registration ? maskRegistration(d.registration) : undefined,
  };
  let derived: DraftResult["derived"] = null;
  let efficiency: Pick<RegisteredVehicle, "efficiencySource" | "efficiencyNote" | "confidence" | "mileageKmPerLitre" | "usableBatteryCapacityKWh" | "fullChargeRangeKm" | "consumptionKWhPer100Km" | "consumptionBasis"> | null = null;

  if (!isEv(mode)) {
    if (!d.unknown) {
      const m = num(d.mileage);
      if (m === undefined) errors.mileage = "Enter your mileage in km/l, or choose “Don't know your mileage?”.";
      else {
        const err = validateMileage(body, powertrain, m);
        if (err) errors.mileage = err;
        else efficiency = { efficiencySource: "user-entered", efficiencyNote: `${m} km/l, entered by you`, confidence: confidenceOf("user-entered"), mileageKmPerLitre: m };
      }
    } else if (cat?.mileageKmPerUnit) {
      efficiency = { efficiencySource: "catalog", efficiencyNote: `${cat.mileageKmPerUnit} km/l from ${cat.source} (${cat.year})`, confidence: confidenceOf("catalog", cat.confidence), mileageKmPerLitre: cat.mileageKmPerUnit };
    } else if (d.fallback === "estimate") {
      const m = num(d.estimate);
      const err = m === undefined ? "Enter your best estimate in km/l." : validateMileage(body, powertrain, m);
      if (err) errors.estimate = err;
      else efficiency = { efficiencySource: "user-entered", efficiencyNote: `${m} km/l, your own estimate`, confidence: "low", mileageKmPerLitre: m };
    } else {
      const m = CATEGORY_DEFAULTS[powertrain === "diesel" ? "diesel" : "petrol"][body];
      efficiency = { efficiencySource: "category-default", efficiencyNote: `${m} km/l — MissionEV's category default for a ${powertrain} ${body.replace("_", "-")}, not your vehicle's own figure`, confidence: "low", mileageKmPerLitre: m };
    }
  } else {
    const rangeBased = d.evMethod === "range";
    if (!d.unknown) {
      if (rangeBased) {
        const b = num(d.battery);
        const r = num(d.range);
        if (b === undefined) errors.battery = "Enter the usable battery capacity in kWh, or choose “Don't know battery capacity?”.";
        if (r === undefined) errors.range = "Enter the real-world range on a full charge in km.";
        const e = validateEvInputs(body, { usableBatteryKWh: b, rangeKm: r });
        if (e.usableBatteryKWh) errors.battery = e.usableBatteryKWh;
        if (e.rangeKm) errors.range = e.rangeKm;
        if (!errors.battery && !errors.range && b !== undefined && r !== undefined) {
          const c = evConsumptionFromRange(b, r);
          const bad = validateConsumption(body, c.kWhPerKm);
          if (bad) errors.battery = bad;
          else {
            derived = c;
            efficiency = { efficiencySource: "user-range-battery", efficiencyNote: `${c.formula}, battery-side (an estimate: real consumption varies with driving style, load and temperature)`, confidence: "medium", usableBatteryCapacityKWh: b, fullChargeRangeKm: r, consumptionKWhPer100Km: c.kWhPer100Km, consumptionBasis: "battery" };
          }
        }
      } else {
        const v = num(d.efficiency);
        if (v === undefined) errors.efficiency = "Enter your energy consumption, or choose “Don't know energy consumption?”.";
        else {
          const e = validateEvInputs(body, d.efficiencyUnit === "kWh/100km" ? { kWhPer100Km: v } : { kmPerKWh: v });
          const msg = e.kWhPer100Km ?? e.kmPerKWh;
          if (msg) errors.efficiency = msg;
          else {
            const c = d.efficiencyUnit === "kWh/100km" ? evConsumptionFromPer100Km(v) : evConsumptionFromKmPerKWh(v);
            derived = c;
            efficiency = { efficiencySource: "user-kwh-per-100km", efficiencyNote: `${c.formula}, ${d.efficiencyBasis === "wall" ? "electricity drawn from the charger" : "battery-side (as a dashboard reports it)"}`, confidence: "medium", consumptionKWhPer100Km: c.kWhPer100Km, consumptionBasis: d.efficiencyBasis };
          }
        }
      }
    } else if (cat && (cat.kWhPer100Km || (cat.usableBatteryKWh && cat.rangeKm))) {
      const c = cat.kWhPer100Km ? evConsumptionFromPer100Km(cat.kWhPer100Km) : evConsumptionFromRange(cat.usableBatteryKWh!, cat.rangeKm!);
      derived = c;
      efficiency = { efficiencySource: "catalog", efficiencyNote: `${c.formula} from ${cat.source} (${cat.year}); certified figures usually understate real-world use`, confidence: confidenceOf("catalog", cat.confidence), consumptionKWhPer100Km: c.kWhPer100Km, usableBatteryCapacityKWh: cat.usableBatteryKWh, fullChargeRangeKm: cat.rangeKm, consumptionBasis: "battery" };
    } else if (d.fallback === "estimate") {
      const v = num(d.estimate);
      const e = v === undefined ? { kWhPer100Km: "Enter your best estimate in kWh/100 km." } : validateEvInputs(body, { kWhPer100Km: v });
      if (e.kWhPer100Km) errors.estimate = e.kWhPer100Km;
      else if (v !== undefined) {
        const c = evConsumptionFromPer100Km(v);
        derived = c;
        efficiency = { efficiencySource: "user-kwh-per-100km", efficiencyNote: `${v} kWh/100 km, your own estimate (battery-side)`, confidence: "low", consumptionKWhPer100Km: c.kWhPer100Km, consumptionBasis: "battery" };
      }
    } else {
      const spec = categoryDefaultSpec(body, "electric");
      const per100 = spec.consumptionKWhPerKm! * 100;
      derived = evConsumptionFromPer100Km(per100);
      efficiency = { efficiencySource: "category-default", efficiencyNote: `${per100} kWh/100 km — MissionEV's category default for an electric ${body.replace("_", "-")}, not your vehicle's own figure`, confidence: "low", consumptionKWhPer100Km: per100, consumptionBasis: "battery" };
    }
  }

  const ok = Object.keys(errors).length === 0 && efficiency !== null;
  return { errors, vehicle: ok ? { ...base, ...efficiency! } : null, derived, match };
}
