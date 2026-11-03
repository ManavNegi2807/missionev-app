"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { userIdFor, type AccountMethod } from "@/lib/account";
import type { TransportProfile } from "@/lib/transport/profile";
import { useWallet } from "./wallet-provider";

/**
 * The signed-in account and the commuter's transport profile, shared by every screen.
 *
 * The account is a wallet address (MetaMask) or a clearly labelled demo account. No phone number, name or e-mail is ever
 * collected. The record lives in sessionStorage (cleared when the tab closes), not on a server.
 */
export interface RegistrationRecord {
  /** A short one-way id derived from the address; see `userIdFor`. */
  userId: string;
  account: {
    /** "wallet": a browser wallet connected and shared its public address. "demo": no wallet; nothing is ever on-chain. */
    method: "wallet" | "demo";
    signedInAt: number;
  };
  /**
   * What the commuter regularly uses. null = not set up yet. A profile with no vehicles is valid: metro, bus, walking and
   * ride-hail journeys need none. The mode of each journey is chosen per trip, never inferred from this profile.
   */
  transport: TransportProfile | null;
  /** The account's address: a real wallet's, or the synthetic demo address. The demo ledger and redemptions are filed under it. */
  wallet: {
    address: string;
    chainId: number;
    mode: "browser" | "demo";
  };
  /** True for a demo account (no wallet), whose results are all simulated. */
  isDemoData: boolean;
  registeredAt: number;
}

const KEY = "missionev:d1:registration";
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheVal: RegistrationRecord | null = null;

/** Rejects records written by an older build (phone sign-in, single-vehicle profile) instead of crashing on them. */
function isRecord(x: unknown): x is RegistrationRecord {
  const r = x as Partial<RegistrationRecord> | null;
  const method = r?.account?.method;
  return Boolean(r && typeof r.userId === "string" && (method === "wallet" || method === "demo") && r.wallet && "transport" in r);
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

export interface SignInInput {
  method: AccountMethod;
  address: string;
  chainId: number;
}

interface OnboardingValue {
  registration: RegistrationRecord | null;
  isRegistered: boolean;
  /** False during SSR / first hydration pass. */
  ready: boolean;
  /** Start a fresh session for this address (a connected wallet's, or the demo address). */
  signIn(input: SignInInput): Promise<void>;
  /** Save the commuter's transport profile on the signed-in account. */
  saveTransport(profile: TransportProfile): void;
  /** Sign out: forgets the account and profile in this tab. */
  resetRegistration(): void;
}

async function newRecord({ method, address, chainId }: SignInInput, transport: TransportProfile | null): Promise<RegistrationRecord> {
  const now = Date.now();
  return {
    userId: await userIdFor(address),
    account: { method, signedInAt: now },
    transport,
    wallet: { address, chainId, mode: method === "wallet" ? "browser" : "demo" },
    isDemoData: method === "demo",
    registeredAt: now,
  };
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

const noopSubscribe = () => () => {};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const registration = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const wallet = useWallet();

  const signIn = useCallback(async (input: SignInInput) => write(await newRecord(input, null)), []);
  const saveTransport = useCallback((transport: TransportProfile) => {
    const current = read();
    if (current) write({ ...current, transport });
  }, []);
  const resetRegistration = useCallback(() => write(null), []);

  /**
   * The connected wallet is the account. Connecting one while on a demo account upgrades it (the transport profile is kept);
   * switching accounts inside MetaMask starts that address's own session; a network switch just updates the chain id.
   */
  const { mode: walletMode, address: walletAddress, chainId: walletChain } = wallet;
  useEffect(() => {
    if (!registration || walletMode !== "browser" || !walletAddress) return;
    const sameAddress = registration.wallet.address.toLowerCase() === walletAddress.toLowerCase();
    if (registration.account.method === "wallet" && sameAddress) {
      if (walletChain !== null && walletChain !== registration.wallet.chainId) write({ ...registration, wallet: { ...registration.wallet, chainId: walletChain } });
      return;
    }
    let cancelled = false;
    const keep = registration.account.method === "demo" ? registration.transport : null;
    void newRecord({ method: "wallet", address: walletAddress, chainId: walletChain ?? registration.wallet.chainId }, keep).then((rec) => {
      if (!cancelled) write(rec);
    });
    return () => {
      cancelled = true;
    };
  }, [registration, walletMode, walletAddress, walletChain]);

  const value = useMemo(
    () => ({ registration, isRegistered: registration !== null, ready, signIn, saveTransport, resetRegistration }),
    [registration, ready, signIn, saveTransport, resetRegistration],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  return ctx;
}
