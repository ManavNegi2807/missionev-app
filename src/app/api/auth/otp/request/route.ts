import { normalizePhone, validatePhone } from "@/lib/auth";
import { createLimiter, json, readJson } from "@/server/http";

const allow = createLimiter(5, 10 * 60_000);

/**
 * POST /api/auth/otp/request — MOCK ADAPTER. No SMS provider is configured, so nothing is sent: the one-time password is a
 * fixed demo value shown by the UI, and the response says so ("delivery": "demo"). A real provider replaces the body of
 * this handler; the rate limit and validation stay.
 */
export async function POST(request: Request) {
  const body = await readJson(request, 2_000);
  if (!body.ok) return body.response;
  const phone = String((body.body as { phone?: unknown } | null)?.phone ?? "");
  const problem = validatePhone(phone);
  if (problem) return json({ status: "invalid", reason: problem }, 400);
  if (!allow(normalizePhone(phone))) return json({ status: "rate-limited", reason: "Too many OTP requests for this number. Wait a few minutes." }, 429);
  return json({ status: "sent", delivery: "demo", message: "Demo mode: no SMS was sent. Use the demo OTP shown on screen." });
}
