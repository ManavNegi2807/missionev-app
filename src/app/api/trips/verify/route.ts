import type { GpsSample } from "@/lib/trip/types";
import { assignTrust, checkMotion, checkRoute, checkVehicle, type VerifyContext } from "@/lib/trip/verification";
import { json, readJson } from "@/server/http";
import { parseSignRequest } from "@/server/signService";

/**
 * POST /api/trips/verify — runs the oracle's checks on trip evidence without signing anything. The body is the same
 * evidence shape the oracle receives (the wallet proof is ignored here), so a screen can preview whether a trip would pass.
 */
export async function POST(request: Request) {
  const body = await readJson(request, 2_000_000);
  if (!body.ok) return body.response;
  const raw = body.body as { commuter?: string; proof?: unknown; trip?: unknown } | null;
  // Reuse the strict parser; a placeholder proof lets this route share it.
  const parsed = parseSignRequest({ ...raw, commuter: raw?.commuter ?? `0x${"0".repeat(40)}`, proof: { message: "-", signature: `0x${"0".repeat(130)}` } });
  if (!parsed.ok) return json({ status: "invalid", reason: parsed.reason }, 400);
  const t = parsed.req.trip;
  const samples: GpsSample[] = t.samples.map(([lat, lng, tt, speedKmh]) => ({ lat, lng, t: tt, speedKmh }));
  const ctx: VerifyContext = { tripId: t.clientTripId, source: t.source, scenario: "clean", mode: t.mode, route: null, samples, distanceKm: t.distanceKm, durationSec: t.durationSec, vehicle: t.vehicle, rideHail: t.rideHail, knownFingerprints: [] };
  const checks = { "3.1": checkVehicle(ctx), "3.2": { id: "3.2" as const, status: "na" as const, isDemo: false, summary: "Not used by the oracle.", items: [], technical: {}, at: null }, "3.3": checkMotion(ctx), "3.4": checkRoute(ctx) };
  const trust = assignTrust(checks);
  return json({ status: "ok", trust, checks });
}
