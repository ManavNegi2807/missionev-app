import type { ContractModeMapping, JourneyMode, RewardEligibility, VehicleEnergySpec } from "./types";

/**
 * Whether a journey may earn $MEV. This is MissionEV's OWN policy, applied before anything is signed.
 * The deployed contract enforces none of it: it mints a base reward for any positive avoided grams whatever the mode, and
 * a mode bonus (10 MEV EV/metro, 15 MEV active) even when avoided grams are zero. The oracle's refusal to sign
 * ineligible journeys is therefore the only gate.
 */
export function rewardEligibility(args: {
  mode: JourneyMode;
  vehicle?: VehicleEnergySpec;
  co2AvoidedGrams: number;
  contract: ContractModeMapping;
}): RewardEligibility {
  const { mode, vehicle, co2AvoidedGrams, contract } = args;

  const fossil =
    mode === "private_petrol_car" ||
    mode === "private_diesel_car" ||
    mode === "private_ice_2w" ||
    (mode === "ride_hail" && vehicle !== undefined && vehicle.powertrain !== "electric");
  if (fossil) {
    return {
      eligible: false,
      reason: "Petrol, diesel and CNG journeys are measured and shown, but not rewarded. This is a MissionEV policy; the contract itself would not stop it.",
    };
  }
  if (co2AvoidedGrams <= 0) {
    return { eligible: false, reason: "No emissions were avoided against the reference journey, so there is nothing to reward." };
  }
  if (!contract.supported) {
    return { eligible: false, reason: contract.reason ?? "The contract can't record this kind of journey yet." };
  }
  return { eligible: true, reason: "Lower emissions than the reference journey, in a mode the contract can record." };
}
