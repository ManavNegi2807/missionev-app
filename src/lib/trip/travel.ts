import type { JourneyMode, VehicleBody } from "@/lib/carbon/types";

export interface TravelModeInfo {
  id: JourneyMode;
  label: string;
  /** One-line explanation of how the journey is calculated. */
  note: string;
}

/** Every transport a journey can be made by. A private mode needs a matching saved vehicle; the rest need none. */
export const TRAVEL_MODES: readonly TravelModeInfo[] = [
  { id: "private_ev_car", label: "Private EV car", note: "Charging emissions from your car's energy use, compared with an average petrol car." },
  { id: "private_ev_2w", label: "Private EV two-wheeler", note: "Charging emissions compared with an average petrol two-wheeler." },
  { id: "private_petrol_car", label: "Private petrol car", note: "Measured from your mileage. Petrol trips are shown but earn no $MEV." },
  { id: "private_diesel_car", label: "Private diesel car", note: "Measured from your mileage. Diesel trips are shown but earn no $MEV." },
  { id: "private_ice_2w", label: "Petrol two-wheeler", note: "Measured from your mileage. Shown but earns no $MEV; the contract has no mode for it." },
  { id: "ride_hail", label: "Ola / Uber / Rapido", note: "The vehicle on your ride receipt decides the result, not what you own." },
  { id: "metro", label: "Metro", note: "Per passenger-km. No vehicle needed." },
  { id: "ebus", label: "Electric bus", note: "Per passenger-km. No vehicle needed." },
  { id: "active", label: "Walking / cycling", note: "Zero emissions at the point of energy use. No vehicle needed." },
];

export const TRAVEL_LABEL = Object.fromEntries(TRAVEL_MODES.map((m) => [m.id, m.label])) as Record<JourneyMode, string>;

export const isPrivateMode = (m: JourneyMode) => m.startsWith("private_");

/** Selects speed and motion limits for the plausibility checks. */
export type SpeedClass = "car" | "two_wheeler" | "metro" | "ebus" | "active";

export const speedClassOf = (mode: JourneyMode, vehicleBody?: VehicleBody | null): SpeedClass => {
  if (mode === "metro" || mode === "ebus" || mode === "active") return mode;
  if (mode === "private_ev_2w" || mode === "private_ice_2w") return "two_wheeler";
  if (mode === "ride_hail") return vehicleBody === "two_wheeler" ? "two_wheeler" : "car";
  return "car";
};
