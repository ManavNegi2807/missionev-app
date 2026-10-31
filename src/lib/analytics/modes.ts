import type { TripRecord } from "@/lib/trip/types";

/** The six analytics transport categories. */
export const MODE_IDS = ["ev", "petrol", "diesel", "metro", "ebus", "active"] as const;
export type ModeId = (typeof MODE_IDS)[number];

export interface ModeInfo {
  id: ModeId;
  label: string;
  /** Lower-emission category (counts toward "clean mobility share"). Grid emissions are still included in the estimate. */
  clean: boolean;
  /** Chart colour (hex mirrors the Tailwind theme tokens; SVG needs literal values). */
  color: string;
  /** Whether MissionEV.sol can mint a reward for it. Petrol and diesel have contract modes, but MissionEV never signs them. */
  inContract: boolean;
  note: string;
}

export const MODES: Record<ModeId, ModeInfo> = {
  ev: { id: "ev", label: "EV", clean: true, color: "var(--mode-ev)", inContract: true, note: "Electric cars and two-wheelers. Charging (grid) emissions are counted." },
  petrol: { id: "petrol", label: "Petrol / CNG", clean: false, color: "var(--mode-petrol)", inContract: false, note: "Petrol and CNG vehicles. Tracked for your footprint but never rewarded." },
  diesel: { id: "diesel", label: "Diesel", clean: false, color: "var(--mode-diesel)", inContract: false, note: "Diesel cars and SUVs. Tracked for your footprint but never rewarded." },
  metro: { id: "metro", label: "Metro", clean: true, color: "var(--mode-metro)", inContract: true, note: "Per passenger-km from an energy-intensity estimate (low confidence)." },
  ebus: { id: "ebus", label: "Electric bus", clean: true, color: "var(--mode-ebus)", inContract: true, note: "Per passenger-km from bus energy use and an assumed load (low confidence)." },
  active: { id: "active", label: "Walking / cycling", clean: true, color: "var(--mode-active)", inContract: true, note: "Zero emissions at the point of energy use." },
};

export const MODE_LIST: ModeInfo[] = MODE_IDS.map((id) => MODES[id]);
export const isClean = (m: ModeId) => MODES[m].clean;

/** Analytics category of a captured trip, from the transport used (and the confirmed vehicle for ride-hail). */
export function modeOfTrip(t: Pick<TripRecord, "mode" | "vehicle">): ModeId {
  switch (t.mode) {
    case "private_ev_car":
    case "private_ev_2w":
      return "ev";
    case "private_diesel_car":
      return "diesel";
    case "private_petrol_car":
    case "private_ice_2w":
      return "petrol";
    case "ride_hail": {
      const p = t.vehicle?.spec.powertrain;
      return p === "electric" ? "ev" : p === "diesel" ? "diesel" : "petrol";
    }
    default:
      return t.mode;
  }
}
