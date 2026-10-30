import type { FuelType, VehicleCategory } from "@/lib/vehicle";

/** The six analytics transport categories. */
export const MODE_IDS = ["ev", "petrol", "diesel", "metro", "ebus", "active"] as const;
export type ModeId = (typeof MODE_IDS)[number];

export interface ModeInfo {
  id: ModeId;
  label: string;
  /** Zero-tailpipe category (counts toward "clean mobility share"). Grid emissions are still included in the estimate. */
  clean: boolean;
  /** Chart colour (hex mirrors the Tailwind theme tokens; SVG needs literal values). */
  color: string;
  /** Whether MissionEVRewards.sol has a vehicle class for it. If not, no on-chain reward can exist today. */
  inContract: boolean;
  note: string;
}

export const MODES: Record<ModeId, ModeInfo> = {
  ev: { id: "ev", label: "EV", clean: true, color: "var(--mode-ev)", inContract: true, note: "Electric two-wheelers and cars. Zero tailpipe; grid emissions counted." },
  petrol: { id: "petrol", label: "Petrol", clean: false, color: "var(--mode-petrol)", inContract: true, note: "Petrol vehicles. Hybrid and CNG vehicles are grouped here (fossil, non-diesel)." },
  diesel: { id: "diesel", label: "Diesel", clean: false, color: "var(--mode-diesel)", inContract: true, note: "Diesel cars, SUVs and commercial vehicles." },
  metro: { id: "metro", label: "Metro", clean: true, color: "var(--mode-metro)", inContract: false, note: "Per-passenger-km illustrative factor; not in the deployed contract." },
  ebus: { id: "ebus", label: "Electric bus", clean: true, color: "var(--mode-ebus)", inContract: false, note: "Per-passenger-km illustrative factor; not in the deployed contract." },
  active: { id: "active", label: "Walking / cycling", clean: true, color: "var(--mode-active)", inContract: false, note: "Zero direct emissions; not in the deployed contract." },
};

export const MODE_LIST: ModeInfo[] = MODE_IDS.map((id) => MODES[id]);
export const isClean = (m: ModeId) => MODES[m].clean;

/**
 * ILLUSTRATIVE per-passenger-km factors (mg CO₂ per km) for modes the contract has no class for.
 * These are placeholders in the same spirit as the contract's own DEMO constants — replace with
 * published DMRC / transit-operator figures before using any number externally.
 */
export const TRANSIT_MG_PER_KM: Record<"metro" | "ebus" | "active", number> = {
  metro: 32_000,
  ebus: 38_000,
  active: 0,
};

/** Map a registered vehicle (Screen 01) to an analytics mode. */
export function modeFromVehicle(category: VehicleCategory, fuel: FuelType): ModeId {
  if (fuel === "Electric" || category === "Electric two-wheeler" || category === "Electric car") return "ev";
  if (fuel === "Diesel") return "diesel";
  return "petrol";
}
