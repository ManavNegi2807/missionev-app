import type { ContractModeMapping, JourneyMode, VehicleEnergySpec } from "./types";

/**
 * MissionEV.sol `TransportMode`. These numbers are part of the deployed contract's ABI: never reorder or renumber them.
 * New categories would need a new contract version, not a change here.
 */
export const TRANSPORT_MODE = {
  EV_CAR: 0,
  EV_2W: 1,
  METRO: 2,
  EBUS: 3,
  ACTIVE: 4,
  ICE_CAR: 5,
  ICE_SUV: 6,
} as const;

export type TransportModeName = keyof typeof TRANSPORT_MODE;

const NAMES = Object.keys(TRANSPORT_MODE) as TransportModeName[];
export const transportModeName = (mode: number): TransportModeName | null => NAMES.find((n) => TRANSPORT_MODE[n] === mode) ?? null;

const ok = (name: TransportModeName): ContractModeMapping => ({ supported: true, mode: TRANSPORT_MODE[name], modeName: name });
const no = (reason: string): ContractModeMapping => ({ supported: false, mode: null, modeName: null, reason });

/**
 * Maps a journey onto the contract's enum. The mapping follows the vehicle that actually carried the commuter:
 * a ride-hail journey is classified by the confirmed underlying vehicle, never by the provider's name.
 * Anything the enum can't express stays calculable off-chain and is reported as unsupported.
 */
export function contractModeFor(mode: JourneyMode, vehicle?: VehicleEnergySpec): ContractModeMapping {
  switch (mode) {
    case "metro":
      return ok("METRO");
    case "ebus":
      return ok("EBUS");
    case "active":
      return ok("ACTIVE");
    case "private_ev_car":
      return ok("EV_CAR");
    case "private_ev_2w":
      return ok("EV_2W");
    case "private_petrol_car":
    case "private_diesel_car":
      return ok(vehicle?.isSuv ? "ICE_SUV" : "ICE_CAR");
    case "private_ice_2w":
      return no("The contract has no two-wheeler petrol/diesel mode. The journey is calculated off-chain only.");
    case "ride_hail": {
      if (!vehicle) return no("The ride's vehicle isn't confirmed yet, so it can't be matched to a contract mode.");
      if (vehicle.powertrain === "electric") return ok(vehicle.body === "car" ? "EV_CAR" : "EV_2W");
      if (vehicle.body === "car" && (vehicle.powertrain === "petrol" || vehicle.powertrain === "diesel")) return ok(vehicle.isSuv ? "ICE_SUV" : "ICE_CAR");
      return no(
        vehicle.powertrain === "cng"
          ? "The contract has no CNG mode. The journey is calculated off-chain only."
          : "The contract has no two-wheeler petrol/diesel mode. The journey is calculated off-chain only.",
      );
    }
  }
}
