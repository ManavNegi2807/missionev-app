import { evaluateAndSign, parseSignRequest } from "@/server/signService";
import { createLimiter, json, readJson } from "@/server/http";
import { getRuntime } from "@/server/runtime";

const allow = createLimiter(20, 60_000);

/**
 * POST /api/oracle/sign-trip — the trusted oracle. Authenticates the request with a wallet signature, re-verifies the trip,
 * recalculates the emissions itself and signs only what it derived. The oracle private key never leaves this process.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(ip)) return json({ status: "rate-limited", reason: "Too many requests. Try again in a minute." }, 429);

  const body = await readJson(request, 2_000_000);
  if (!body.ok) return body.response;
  const parsed = parseSignRequest(body.body);
  if (!parsed.ok) return json({ status: "invalid", reason: parsed.reason }, 400);

  const rt = getRuntime();
  if (!rt.reader) return json({ status: "unavailable", reason: "The oracle isn't configured on this server (contract address or RPC URL missing). Nothing was signed." }, 503);

  const outcome = await evaluateAndSign(parsed.req, { config: rt.config, reader: rt.reader, store: rt.store });
  if (outcome.status === "signed") {
    rt.log.set(outcome.signed.tripId, {
      tripId: outcome.signed.tripId,
      commuter: parsed.req.commuter.toLowerCase(),
      mode: outcome.signed.mode,
      modeName: outcome.signed.modeName,
      distanceMeters: outcome.signed.distanceMeters,
      co2AvoidedGrams: outcome.signed.co2AvoidedGrams,
      nonce: outcome.signed.nonce,
      deadline: outcome.signed.deadline,
      signedAt: outcome.signed.signedAt,
    });
  }
  const { httpStatus, ...rest } = outcome;
  return json(rest, httpStatus);
}
