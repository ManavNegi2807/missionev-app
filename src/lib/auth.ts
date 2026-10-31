/**
 * Mobile-number sign-in with a DEMO one-time password.
 *
 * There is no SMS gateway and no user database: any valid mobile number can sign in (it doesn't have to be
 * "registered" anywhere) and the OTP is a fixed demo value shown on screen. The number itself is never stored,
 * only a masked form and a salted fingerprint. Replace the handlers in app/api/auth/otp with a real SMS-OTP provider
 * to go live.
 */
export const DEMO_OTP = "123456";
export const OTP_LENGTH = DEMO_OTP.length;

/** Digits only; strips a +91 / 0 prefix when a full number is pasted. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

export function validatePhone(raw: string): string | undefined {
  const n = normalizePhone(raw);
  if (!n) return "Enter your mobile number.";
  if (n.length < 10) return "A mobile number has 10 digits.";
  if (!/^[6-9]/.test(n)) return "Indian mobile numbers start with 6, 7, 8 or 9.";
  return undefined;
}

/** "+91 ••••••3210": enough to recognise, not enough to reconstruct. */
export const maskPhone = (normalized: string) => `+91 ••••••${normalized.slice(-4)}`;

export const normalizeOtp = (raw: string) => raw.replace(/\D/g, "").slice(0, OTP_LENGTH);

/**
 * Both calls go to the server's mock adapters (/api/auth/otp/*). They are MOCKS: no SMS is sent and the OTP is the fixed
 * demo value above. The server answers `delivery: "demo"`, which is what the UI shows the commuter.
 */
async function call(path: string, body: unknown, signal?: AbortSignal): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
    const data = (await res.json().catch(() => ({}))) as { reason?: string };
    return { ok: res.ok, reason: data.reason };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return { ok: false, reason: "The server couldn't be reached. Check your connection and try again." };
  }
}

/** Asks the server to "send" an OTP. Nothing is sent anywhere. Rejects with a readable message when the server refuses. */
export async function sendOtp(phone: string, signal?: AbortSignal): Promise<void> {
  const r = await call("/api/auth/otp/request", { phone: normalizePhone(phone) }, signal);
  if (!r.ok) throw new Error(r.reason ?? "Couldn't start sign-in.");
}

export async function checkOtp(phone: string, otp: string, signal?: AbortSignal): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await call("/api/auth/otp/verify", { phone: normalizePhone(phone), otp }, signal);
  return r.ok ? { ok: true } : { ok: false, message: r.reason ?? `Incorrect OTP. This demo only accepts ${DEMO_OTP}.` };
}
