"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { TransportProfile } from "@/lib/transport/profile";

/**
 * D1 — Users & Vehicles (frontend state).
 *
 * Holds the result of process 1.0 (mobile sign-in + the commuter's transport profile) for later screens.
 * Only a MASKED mobile number and a salted fingerprint are kept, and the record lives in sessionStorage
 * (cleared when the tab closes), not on a server.
 */
export interface RegistrationRecord {
  userId: string;
  phone: {
    masked: string;
    verifiedAt: number;
    /** The OTP is a fixed demo value; no SMS was sent. */
    method: "demo-otp";
  };
  /**
   * What the commuter regularly uses. null = not set up yet. A profile with no vehicles is valid: metro, bus, walking and
   * ride-hail journeys need none. The mode of each journey is chosen per trip, never inferred from this profile.
   */
  transport: TransportProfile | null;
  /** Reward account the demo ledger and redemptions are filed under. A real browser wallet is optional and separate. */
  wallet: {
    address: string;
    chainId: number;
    mode: "browser" | "demo";
  };
  /** True while any input (the OTP sign-in) is simulated. */
  isDemoData: boolean;
  registeredAt: number;
}

const KEY = "missionev:d1:registration";
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheVal: RegistrationRecord | null = null;

/** Rejects records written by an older build (single-vehicle profile) instead of crashing on them. */
function isRecord(x: unknown): x is RegistrationRecord {
  const r = x as Partial<RegistrationRecord> | null;
  return Boolean(r && typeof r.userId === "string" && typeof r.phone?.masked === "string" && r.wallet && "transport" in r);
}

function read(): RegistrationRecord | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return cacheVal; // storage blocked: fall back to in-memory value
  }
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cacheVal = isRecord(parsed) ? parsed : null;
  } catch {
    cacheVal = null;
  }
  return cacheVal;
}

function write(rec: RegistrationRecord | null) {
  cacheVal = rec;
  try {
    if (rec) sessionStorage.setItem(KEY, JSON.stringify(rec));
    else sessionStorage.removeItem(KEY);
    cacheRaw = undefined; // force re-read to resync
  } catch {
    /* storage unavailable: in-memory only */
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

interface OnboardingValue {
  registration: RegistrationRecord | null;
  isRegistered: boolean;
  /** False during SSR / first hydration pass. */
  ready: boolean;
  saveRegistration(rec: RegistrationRecord): void;
  /** Save the commuter's transport profile on the signed-in account. */
  saveTransport(profile: TransportProfile): void;
  /** Sign out: forgets the account and profile in this tab. */
  resetRegistration(): void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

const noopSubscribe = () => () => {};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const registration = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const saveRegistration = useCallback((rec: RegistrationRecord) => write(rec), []);
  const saveTransport = useCallback((transport: TransportProfile) => {
    const current = read();
    if (current) write({ ...current, transport });
  }, []);
  const resetRegistration = useCallback(() => write(null), []);

  const value = useMemo(
    () => ({ registration, isRegistered: registration !== null, ready, saveRegistration, saveTransport, resetRegistration }),
    [registration, ready, saveRegistration, saveTransport, resetRegistration],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  return ctx;
}
