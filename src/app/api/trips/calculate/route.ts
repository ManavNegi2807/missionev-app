import { calculateJourney, JourneyInputError } from "@/lib/carbon/emissionsEngine";
import type { JourneyMode, VehicleEnergySpec } from "@/lib/carbon/types";
import { json, readJson } from "@/server/http";

const MODES: readonly JourneyMode[] = ["private_ev_car", "private_ev_2w", "private_petrol_car", "private_diesel_car", "private_ice_2w", "ride_hail", "metro", "ebus", "active"];

/**
 * POST /api/trips/calculate — the shared carbon engine as a service. It signs nothing and changes nothing: it returns the
 * same calculation the browser shows, so the two can be compared. The oracle recalculates independently before signing.
 */
export async function POST(request: Request) {
  const body = await readJson(request, 20_000);
  if (!body.ok) return body.response;
  const b = body.body as { mode?: JourneyMode; distanceKm?: number; vehicle?: VehicleEnergySpec; occupants?: number; at?: number } | null;
  if (!b || !MODES.includes(b.mode as JourneyMode) || typeof b.distanceKm !== "number") return json({ status: "invalid", reason: "mode and distanceKm are required." }, 400);
  try {
    return json({ status: "ok", carbon: calculateJourney({ mode: b.mode as JourneyMode, distanceKm: b.distanceKm, vehicle: b.vehicle, occupants: b.occupants, at: b.at }) });
  } catch (e) {
    return json({ status: "invalid", reason: e instanceof JourneyInputError ? e.message : "The journey couldn't be calculated." }, 400);
  }
}
