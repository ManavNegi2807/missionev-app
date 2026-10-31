import { DEMO_OTP, normalizeOtp, normalizePhone, validatePhone } from "@/lib/auth";
import { createLimiter, json, readJson } from "@/server/http";

const allow = createLimiter(10, 10 * 60_000);

/**
 * POST /api/auth/otp/verify — MOCK ADAPTER. Checks the fixed demo OTP on the server, so the check at least isn't a
 * client-side constant comparison. It is NOT authentication: any valid number can sign in and no session is issued.
 */
export async function POST(request: Request) {
  const body = await readJson(request, 2_000);
  if (!body.ok) return body.response;
  const b = body.body as { phone?: unknown; otp?: unknown } | null;
  const phone = String(b?.phone ?? "");
  const problem = validatePhone(phone);
  if (problem) return json({ status: "invalid", reason: problem }, 400);
  if (!allow(normalizePhone(phone))) return json({ status: "rate-limited", reason: "Too many attempts. Wait a few minutes." }, 429);
  if (normalizeOtp(String(b?.otp ?? "")) !== DEMO_OTP) return json({ status: "rejected", reason: `Incorrect OTP. This demo only accepts ${DEMO_OTP}.` }, 401);
  return json({ status: "verified", delivery: "demo", authenticated: false });
}
