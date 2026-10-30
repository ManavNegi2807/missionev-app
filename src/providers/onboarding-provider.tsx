"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { FuelType, VehicleCategory } from "@/lib/vehicle";

/**
 * D1 — Users & Vehicles (frontend state).
 *
 * Holds the result of process 1.0 for later screens. Only a MASKED registration
 * number and a salted fingerprint are kept — never the full identifier — and the
 * record lives in sessionStorage (cleared when the tab closes), not on a server.
 */
export interface RegistrationRecord {
  userId: string;
  wallet: {
    address: string;
    chainId: number;
    mode: "browser" | "demo";
  };
  vehicle: {
    maskedReg: string;
    fingerprint: string | null;
    category: VehicleCategory;
    fuel: FuelType;
    manufacturer: string;
    model: string;
    year: number;
    rcStatus: "ACTIVE";
    registrySource: "DEMO_REGISTRY";
    registryRef: string;
    verifiedAt: number;
  };
  /** True while any input (wallet or registry) is simulated. */
  isDemoData: boolean;
  registeredAt: number;
}

const KEY = "missionev:d1:registration";
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheVal: RegistrationRecord | null = null;

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
    cacheVal = raw ? (JSON.parse(raw) as RegistrationRecord) : null;
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
  resetRegistration(): void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

const noopSubscribe = () => () => {};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const registration = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const saveRegistration = useCallback((rec: RegistrationRecord) => write(rec), []);
  const resetRegistration = useCallback(() => write(null), []);

  const value = useMemo(
    () => ({ registration, isRegistered: registration !== null, ready, saveRegistration, resetRegistration }),
    [registration, ready, saveRegistration, resetRegistration],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  return ctx;
}
