"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FlaskConical, LogOut, MessageSquareText, Pencil, Smartphone } from "lucide-react";
import { TextField } from "@/components/ui/fields";
import { Alert, Badge, Button, KV, Panel, PanelHeader } from "@/components/ui/primitives";
import { checkOtp, DEMO_OTP, normalizeOtp, normalizePhone, OTP_LENGTH, sendOtp, validatePhone } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format";
import type { RegistrationRecord } from "@/providers/onboarding-provider";

/** "98765 43210" for readability; the state always holds the 10 plain digits. */
const display = (digits: string) => (digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);

export function SigninPanel({
  account,
  onVerified,
  onSignOut,
}: {
  account: RegistrationRecord | null;
  /** Called with the verified 10-digit number once the OTP matches. */
  onVerified: (phone: string) => Promise<void>;
  onSignOut: () => void;
}) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [otpError, setOtpError] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const phoneError = validatePhone(phone);
  const showPhoneError = phoneTouched ? phoneError : undefined;
  const [sendError, setSendError] = useState<string | undefined>();

  const send = async () => {
    setPhoneTouched(true);
    if (phoneError) return;
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    setBusy("send");
    try {
      setSendError(undefined);
      await sendOtp(phone, c.signal);
      setOtp("");
      setOtpError(undefined);
      setStep("otp");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setSendError((e as Error).message || "Couldn't send the OTP. Try again.");
    } finally {
      if (abortRef.current === c) setBusy(null);
    }
  };

  const verify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setOtpError(`Enter the ${OTP_LENGTH}-digit OTP.`);
      return;
    }
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    setBusy("verify");
    setOtpError(undefined);
    try {
      const res = await checkOtp(phone, otp, c.signal);
      if (!res.ok) {
        setOtpError(res.message);
        return;
      }
      await onVerified(phone);
      setStep("phone");
      setPhone("");
      setOtp("");
      setPhoneTouched(false);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setOtpError("Couldn't verify the OTP. Try again.");
    } finally {
      if (abortRef.current === c) setBusy(null);
    }
  };

  const signedIn = account !== null;

  return (
    <Panel aria-labelledby="signin-title">
      <PanelHeader
        id="signin-title"
        eyebrow="Step 1 · Sign in"
        title="Mobile sign-in"
        subtitle="Sign in with just your mobile number. It doesn't need to be registered anywhere first."
        action={
          <Badge tone={signedIn ? "ok" : "warn"} dot>
            {signedIn ? "Signed in" : "Demo OTP"}
          </Badge>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {signedIn ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-ok/40 bg-ok/[0.08] text-ok">
                <CheckCircle2 aria-hidden className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">Signed in</p>
                <p className="mt-0.5 font-mono text-xs text-muted">{account.phone.masked}</p>
              </div>
              <Button variant="danger" onClick={onSignOut} icon={<LogOut aria-hidden className="size-4" />}>
                Sign out
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-line bg-bg-2/60 p-4">
              <KV label="Mobile">{account.phone.masked}</KV>
              <KV label="User" mono>
                {account.userId}
              </KV>
              <KV label="Verified with">Demo OTP</KV>
              <KV label="Signed in at">{formatTimestamp(account.phone.verifiedAt)}</KV>
            </dl>
          </>
        ) : step === "phone" ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="space-y-4"
          >
            <TextField
              label="Mobile number"
              required
              mono
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={display(phone)}
              error={showPhoneError ?? sendError}
              hint="10-digit Indian mobile number. Only a masked form is kept, in this tab."
              onChange={(e) => {
                setPhone(normalizePhone(e.target.value));
                setSendError(undefined);
              }}
              onBlur={() => setPhoneTouched(true)}
            />
            <Button type="submit" variant="primary" size="lg" loading={busy === "send"} icon={<MessageSquareText aria-hidden className="size-4" />} className="w-full sm:w-auto">
              {busy === "send" ? "Sending…" : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            className="space-y-4"
          >
            <p className="text-sm text-muted">
              OTP for <span className="font-mono text-fg">+91 {display(phone)}</span>
            </p>
            <Alert tone="warn" icon={<FlaskConical aria-hidden className="size-4" />} title="DEMO OTP — no SMS is sent">
              Enter <span className="font-mono text-fg">{DEMO_OTP}</span> to sign in. A real build would text a one-time code to this number.
              <button
                type="button"
                onClick={() => {
                  setOtp(DEMO_OTP);
                  setOtpError(undefined);
                }}
                className="ml-2 text-cyan hover:underline"
              >
                Fill it in
              </button>
            </Alert>
            <TextField
              label="One-time password"
              required
              mono
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder={"•".repeat(OTP_LENGTH)}
              maxLength={OTP_LENGTH}
              value={otp}
              error={otpError}
              onChange={(e) => {
                setOtp(normalizeOtp(e.target.value));
                setOtpError(undefined);
              }}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="submit" variant="primary" size="lg" loading={busy === "verify"} icon={<Smartphone aria-hidden className="size-4" />} className="w-full sm:w-auto">
                {busy === "verify" ? "Verifying…" : "Verify & sign in"}
              </Button>
              <Button variant="ghost" onClick={() => void send()} disabled={busy !== null}>
                Resend OTP
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setOtpError(undefined);
                }}
                disabled={busy !== null}
                icon={<Pencil aria-hidden className="size-3.5" />}
              >
                Change number
              </Button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}
