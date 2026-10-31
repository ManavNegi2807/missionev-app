import { CATEGORY_DEFAULTS } from "@/lib/carbon/emissionFactors";
import { validateMileage } from "@/lib/carbon/efficiency";
import type { Powertrain, VehicleBody, VehicleEnergySpec } from "@/lib/carbon/types";
import type { ReceiptExtraction, RideProvider } from "@/lib/ocr/receipt";
import type { RideHailInfo, TripVehicle } from "@/lib/trip/types";
import { EMPTY_DRAFT, resolveDraft, type Fallback, type VehicleModeId } from "./profile";

/**
 * A ride-hail journey is classified by the vehicle that actually carried the commuter, not by the provider. The receipt
 * (read by OCR or typed) suggests it; the commuter confirms the model and fuel. Without an efficiency figure for that
 * model, a labelled category default or the commuter's own estimate is used, and the confidence says so.
 */
export interface RideHailForm {
  provider: RideProvider | "";
  /** Distance printed on the receipt (text while typing). Used to cross-check the GPS distance, never as the calculation input. */
  receiptDistance: string;
  tripDate: string;
  serviceClass: string;
  source: "ocr-reviewed" | "manual";
  ocrConfidence?: { provider: string; distance: string; vehicle: string };
  manufacturer: string;
  model: string;
  body: VehicleBody | "";
  fuel: Powertrain | "";
  isSuv: boolean;
  fallback: Fallback;
  estimate: string;
  occupants: number;
  /** "These details are right." OCR alone never proves the vehicle or its fuel. */
  confirmed: boolean;
}

export const EMPTY_RIDE: RideHailForm = {
  provider: "", receiptDistance: "", tripDate: "", serviceClass: "", source: "manual", manufacturer: "", model: "", body: "", fuel: "",
  isSuv: false, fallback: "default", estimate: "", occupants: 1, confirmed: false,
};

/** Fills the form from OCR output. Everything stays editable and unconfirmed. */
export function rideFromExtraction(x: ReceiptExtraction, prev: RideHailForm = EMPTY_RIDE): RideHailForm {
  return {
    ...prev,
    provider: x.provider ?? prev.provider,
    receiptDistance: x.distanceKm !== null ? String(x.distanceKm) : prev.receiptDistance,
    tripDate: x.tripDate ?? prev.tripDate,
    serviceClass: x.serviceClass ?? prev.serviceClass,
    manufacturer: x.model?.manufacturer ?? prev.manufacturer,
    model: x.model?.model ?? prev.model,
    body: x.model?.body ?? (x.bodyHint === "two_wheeler" ? "two_wheeler" : x.bodyHint === "car" ? "car" : prev.body),
    // The model list says what fuel a catalogued variant has, not what the cab runs on: pre-filled, never trusted.
    fuel: x.model?.powertrain ?? prev.fuel,
    isSuv: x.model?.isSuv ?? prev.isSuv,
    source: "ocr-reviewed",
    ocrConfidence: { provider: x.confidence.provider, distance: x.confidence.distance, vehicle: x.confidence.vehicle },
    confirmed: false,
  };
}

const modeOf = (body: VehicleBody, fuel: Powertrain): VehicleModeId | null =>
  body === "car" ? (fuel === "electric" ? "private_ev_car" : fuel === "petrol" ? "private_petrol_car" : fuel === "diesel" ? "private_diesel_car" : null) : fuel === "electric" ? "private_ev_2w" : fuel === "petrol" ? "private_ice_2w" : null;

export interface RideResolution {
  errors: Partial<Record<keyof RideHailForm | "vehicle", string>>;
  vehicle: TripVehicle | null;
  info: RideHailInfo | null;
}

export function resolveRideHail(f: RideHailForm): RideResolution {
  const errors: RideResolution["errors"] = {};
  if (!f.provider) errors.provider = "Choose Ola, Uber or Rapido.";
  const km = f.receiptDistance.trim() === "" ? null : Number(f.receiptDistance);
  if (km === null || !Number.isFinite(km) || km <= 0 || km > 500) errors.receiptDistance = "Enter the trip distance from the receipt, in km.";
  if (!f.body) errors.body = "Is it a car or a two-wheeler?";
  if (!f.fuel) errors.fuel = "Choose the fuel the vehicle uses.";
  if (f.model.trim().length < 2) errors.model = "Enter the vehicle model.";
  if (f.body === "two_wheeler" && f.fuel && f.fuel !== "petrol" && f.fuel !== "electric") errors.fuel = "Two-wheelers here are petrol or electric.";
  if (f.body && f.fuel === "diesel" && f.body === "two_wheeler") errors.fuel = "Two-wheelers here are petrol or electric.";
  if (Object.keys(errors).length) return { errors, vehicle: null, info: null };

  const body = f.body as VehicleBody;
  const fuel = f.fuel as Powertrain;
  const label = `${f.manufacturer.trim()} ${f.model.trim()}`.trim();
  let spec: VehicleEnergySpec | null = null;

  if (fuel === "cng") {
    if (f.fallback === "estimate") {
      const m = Number(f.estimate);
      const err = f.estimate.trim() === "" ? "Enter your best estimate in km/kg." : validateMileage(body, "cng", m);
      if (err) errors.estimate = err;
      else spec = { body, powertrain: "cng", mileageKmPerUnit: m, efficiencySource: "user-entered", confidence: "low", label };
    } else spec = { body, powertrain: "cng", mileageKmPerUnit: CATEGORY_DEFAULTS.cng[body], efficiencySource: "category-default", confidence: "low", label };
  } else {
    const mode = modeOf(body, fuel);
    if (!mode) return { errors: { vehicle: "That vehicle type isn't supported." }, vehicle: null, info: null };
    const r = resolveDraft({ ...EMPTY_DRAFT, mode, manufacturer: f.manufacturer || "Unknown", model: f.model, unknown: true, fallback: f.fallback, estimate: f.estimate });
    if (!r.vehicle) return { errors: { ...(r.errors.estimate ? { estimate: r.errors.estimate } : {}), vehicle: r.errors.model ?? "The vehicle details aren't usable." }, vehicle: null, info: null };
    spec = {
      body,
      powertrain: fuel,
      isSuv: f.isSuv || undefined,
      efficiencySource: r.vehicle.efficiencySource,
      confidence: r.vehicle.confidence,
      label,
      ...(fuel === "electric" ? { consumptionKWhPerKm: (r.vehicle.consumptionKWhPer100Km ?? 0) / 100, consumptionBasis: "battery" as const } : { mileageKmPerUnit: r.vehicle.mileageKmPerLitre }),
    };
  }
  if (!spec) return { errors, vehicle: null, info: null };

  return {
    errors,
    vehicle: { id: "ride-hail", label, spec },
    info: {
      provider: f.provider as RideProvider,
      occupants: f.occupants,
      receipt: { distanceKm: km, tripDate: f.tripDate || null, serviceClass: f.serviceClass || null, source: f.source, confirmedByUser: f.confirmed, ocrConfidence: f.ocrConfidence },
    },
  };
}
