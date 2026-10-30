"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PORTAL_V3 } from "@/lib/chain";
import { sha256Hex } from "@/lib/format";
import { getRegistryAdapter } from "@/lib/vahan";
import {
  EMPTY_VEHICLE_FORM,
  toVehicleInput,
  validateVehicle,
  type VehicleForm,
  type VehicleInput,
} from "@/lib/vehicle";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useWallet } from "@/providers/wallet-provider";
import { DataFlowPanel } from "./data-flow-panel";
import { StepProgress } from "./step-progress";
import { SummaryPanel, type VehicleSummary } from "./summary-panel";
import { VehiclePanel, type LookupState } from "./vehicle-panel";
import { WalletPanel } from "./wallet-panel";

const NEXT_ROUTE = "/capture-trip";

export function RegisterScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const { registration, saveRegistration, resetRegistration } = useOnboarding();

  const [form, setForm] = useState<VehicleForm>(EMPTY_VEHICLE_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof VehicleForm, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  /** Validated input of the last successful lookup. Kept in memory only (never persisted in full). */
  const [verifiedInput, setVerifiedInput] = useState<VehicleInput | null>(null);
  const [registering, setRegistering] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
      abortRef.current?.abort();
    },
    [],
  );

  const allErrors = useMemo(() => validateVehicle(form), [form]);
  const visibleErrors = useMemo(
    () => Object.fromEntries(Object.entries(allErrors).filter(([k]) => submitted || touched[k as keyof VehicleForm])),
    [allErrors, submitted, touched],
  );
  const formValid = Object.keys(allErrors).length === 0;

  const onChange = useCallback(<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Convenience: electric categories imply Electric power.
      if (key === "category" && typeof value === "string" && value.startsWith("Electric")) next.fuel = "Electric";
      return next;
    });
    // Any edit invalidates a previous verification: the verified data must match what's on screen.
    requestId.current++;
    abortRef.current?.abort();
    setLookup((l) => (l.status === "idle" ? l : { status: "idle" }));
    setVerifiedInput(null);
  }, []);

  const onBlurField = useCallback((key: keyof VehicleForm) => setTouched((t) => ({ ...t, [key]: true })), []);

  const onVerify = useCallback(async () => {
    setSubmitted(true);
    if (!formValid) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const id = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const input = toVehicleInput(form);
    setLookup({ status: "loading" });
    try {
      const res = await getRegistryAdapter().lookup(input, controller.signal);
      if (id !== requestId.current) return;
      if (res.ok) {
        setLookup({ status: "success", record: res.record });
        setVerifiedInput(input);
      } else {
        setLookup({ status: "failure", code: res.code, message: res.message });
        setVerifiedInput(null);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError" || id !== requestId.current) return;
      setLookup({ status: "failure", code: "REGISTRY_UNAVAILABLE", message: "The lookup failed unexpectedly. Try again." });
    }
  }, [form, formValid]);

  const vehicle: VehicleSummary | null = useMemo(() => {
    if (lookup.status === "success") {
      const r = lookup.record;
      return { maskedReg: r.maskedReg, title: `${r.manufacturer} ${r.model}`, verified: true };
    }
    if (registration && lookup.status === "idle") {
      const v = registration.vehicle;
      return { maskedReg: v.maskedReg, title: `${v.manufacturer} ${v.model}`, verified: true };
    }
    return null;
  }, [lookup, registration]);

  const walletReady = wallet.isConnected && (wallet.isDemo || wallet.onExpectedChain);
  const blockedReason = !wallet.isConnected
    ? "Connect a wallet (or use demo mode) to continue."
    : !walletReady
      ? `Switch your wallet to ${PORTAL_V3.name} to continue.`
      : lookup.status !== "success"
        ? "Verify your vehicle to continue."
        : null;

  const goNext = useCallback(() => router.push(NEXT_ROUTE), [router]);

  const onRegister = useCallback(async () => {
    if (blockedReason || lookup.status !== "success" || !verifiedInput || !wallet.address || wallet.chainId === null) return;
    setRegistering(true);
    // Store a salted fingerprint, never the full registration number.
    const fingerprint = (await sha256Hex(`${wallet.address.toLowerCase()}:${verifiedInput.regNumber}`))?.slice(0, 16) ?? null;
    await new Promise((r) => setTimeout(r, 600));
    const r = lookup.record;
    saveRegistration({
      userId: `usr_${(fingerprint ?? r.referenceId.replace("DEMO-", "").toLowerCase()).slice(0, 8)}`,
      wallet: { address: wallet.address, chainId: wallet.chainId, mode: wallet.isDemo ? "demo" : "browser" },
      vehicle: {
        maskedReg: r.maskedReg,
        fingerprint,
        category: r.category,
        fuel: r.fuel,
        manufacturer: r.manufacturer,
        model: r.model,
        year: r.year,
        rcStatus: r.rcStatus,
        registrySource: r.source,
        registryRef: r.referenceId,
        verifiedAt: r.verifiedAt,
      },
      isDemoData: true, // registry adapter is a mock in this prototype
      registeredAt: Date.now(),
    });
    setRegistering(false);
    setJustRegistered(true);
    redirectTimer.current = setTimeout(goNext, 1600);
  }, [blockedReason, lookup, verifiedInput, wallet, saveRegistration, goNext]);

  const onReset = useCallback(() => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
    resetRegistration();
    setJustRegistered(false);
    setLookup({ status: "idle" });
    setVerifiedInput(null);
    setForm(EMPTY_VEHICLE_FORM);
    setTouched({});
    setSubmitted(false);
  }, [resetRegistration]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="page-title" className="space-y-5">
        <p className="font-mono text-[11px] tracking-[0.2em] text-lime sm:text-xs">01 / IDENTITY &amp; VEHICLE REGISTRATION</p>
        <h1 id="page-title" className="max-w-3xl text-[2rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Connect your mobility identity.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
          Register your wallet and vehicle to start recording your mobility journey, measuring estimated emissions, and unlocking transparent rewards.
        </p>
        <StepProgress step={1} label="ACCOUNT INITIALIZATION" />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div ref={formRef} className="min-w-0 space-y-6 lg:col-span-7 xl:col-span-8">
          <WalletPanel />
          <VehiclePanel
            form={form}
            errors={visibleErrors}
            showAllErrors={submitted}
            lookup={lookup}
            onChange={onChange}
            onBlurField={onBlurField}
            onVerify={onVerify}
          />
        </div>
        <div className="min-w-0 lg:col-span-5 xl:col-span-4">
          <SummaryPanel
            vehicle={vehicle}
            formValid={formValid}
            registration={registration}
            registering={registering}
            justRegistered={justRegistered}
            blockedReason={blockedReason}
            onRegister={onRegister}
            onContinue={goNext}
            onReset={onReset}
          />
        </div>
      </div>

      <DataFlowPanel />
    </div>
  );
}
