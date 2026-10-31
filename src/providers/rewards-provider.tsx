"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { fnv1a } from "@/lib/format";
import { CONTRACT, isContractAddress } from "@/lib/contract/config";
import { createSessionStore } from "@/lib/session-store";
import { CATALOG, type CatalogItem } from "@/lib/rewards/catalog";
import { readGas, readOnchain } from "@/lib/rewards/chain";
import { summarize, type DemoGrant, type RewardSummary } from "@/lib/rewards/summary";
import type { ChainEvent, OnchainSnapshot, RedemptionRecord } from "@/lib/rewards/types";
import { useOnboarding } from "./onboarding-provider";
import { useTrip } from "./trip-provider";
import { useWallet } from "./wallet-provider";

/* D4 — Redemptions (always simulated: the contract has no redeem), and the demo top-up ledger. Both live in this tab's session storage. */
const redemptionStore = createSessionStore<RedemptionRecord[]>("missionev:d4:redemptions", []);
const grantStore = createSessionStore<DemoGrant[]>("missionev:d3demo:grants", []);

export interface OnchainChecks {
  addressConfigured: boolean;
  realWallet: boolean;
  onPortal: boolean;
  /** null = not checked yet */
  codeFound: boolean | null;
  balanceReadable: boolean | null;
}

interface RewardsContextValue {
  summary: RewardSummary;
  /** True only when a deployed MissionEV contract was found and its state was read through a real wallet. */
  onchainActive: boolean;
  checks: OnchainChecks;
  onchain: OnchainSnapshot | null;
  chainEvents: ChainEvent[];
  refreshing: boolean;
  chainError: string | null;
  /** tPOT balance in wei, only when read from a real wallet on Portal V3. */
  gasWei: string | null;
  redemptions: RedemptionRecord[];
  stockLeft(item: CatalogItem): number;
  grantDemo(amount: number): void;
  clearSimulated(): void;
  refreshOnchain(): Promise<void>;
  redeem(item: CatalogItem): Promise<RedemptionRecord>;
}

const Ctx = createContext<RewardsContextValue | null>(null);

const newRef = () => `RDM-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0")}`;

export function RewardsProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const { registration } = useOnboarding();
  const { history } = useTrip();
  const redemptions = useSyncExternalStore(redemptionStore.subscribe, redemptionStore.getSnapshot, redemptionStore.getServerSnapshot);
  const grants = useSyncExternalStore(grantStore.subscribe, grantStore.getSnapshot, grantStore.getServerSnapshot);

  const contract = CONTRACT.address;
  const realWallet = wallet.mode === "browser" && !!wallet.address;
  const eligible = isContractAddress(contract) && realWallet && wallet.onExpectedChain;
  const key = eligible ? `${contract}:${wallet.address}:${wallet.chainId}` : null;

  const [data, setData] = useState<{ key: string; snap: OnchainSnapshot } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [gas, setGas] = useState<{ key: string; wei: string } | null>(null);
  const gasKey = realWallet && wallet.onExpectedChain ? `${wallet.address}:${wallet.chainId}` : null;

  const walletRef = useRef(wallet);
  useEffect(() => {
    walletRef.current = wallet;
  });

  const refreshGas = useCallback(async () => {
    const w = walletRef.current;
    if (w.mode !== "browser" || !w.address || !w.onExpectedChain) return;
    try {
      setGas({ key: `${w.address}:${w.chainId}`, wei: await readGas(w.request, w.address) });
    } catch {
      /* leave unknown — never invent a balance */
    }
  }, []);

  useEffect(() => {
    if (gasKey) void refreshGas();
  }, [gasKey, refreshGas]);

  const refreshOnchain = useCallback(async () => {
    void refreshGas();
    const w = walletRef.current;
    if (!contract || w.mode !== "browser" || !w.address || !w.onExpectedChain) return;
    const k = `${contract}:${w.address}:${w.chainId}`;
    setRefreshing(true);
    try {
      const snap = await readOnchain(w.request, contract, w.address);
      setData({ key: k, snap });
      setFailed(null);
    } catch (e) {
      setFailed({ key: k, message: e instanceof Error ? e.message : "Could not read the contract." });
    } finally {
      setRefreshing(false);
    }
  }, [contract, refreshGas]);

  useEffect(() => {
    if (key) void refreshOnchain();
  }, [key, refreshOnchain]);

  // A commute confirmed in the Capture Trip screen changes the contract's state: re-read it rather than guessing.
  const confirmed = history.filter((t) => t.settlement.phase === "confirmed").length;
  const seenConfirmed = useRef(confirmed);
  useEffect(() => {
    if (confirmed > seenConfirmed.current && key) void refreshOnchain();
    seenConfirmed.current = confirmed;
  }, [confirmed, key, refreshOnchain]);

  const snap = key && data?.key === key ? data.snap : null;
  const active = Boolean(snap && snap.hasCode && snap.balance !== null);
  const chainError = key && failed?.key === key ? failed.message : null;

  const checks: OnchainChecks = {
    addressConfigured: Boolean(contract),
    realWallet,
    onPortal: realWallet && wallet.onExpectedChain,
    codeFound: snap ? snap.hasCode : null,
    balanceReadable: snap ? snap.balance !== null : null,
  };

  const summary = useMemo(
    () => summarize({ trips: history, grants, redemptions, onchain: active ? snap : null }),
    [history, grants, redemptions, active, snap],
  );

  const stockLeft = useCallback(
    (item: CatalogItem) => Math.max(0, item.stock - redemptions.filter((r) => r.itemId === item.id && r.status !== "failed").length),
    [redemptions],
  );

  const grantDemo = useCallback((amount: number) => {
    grantStore.set([{ id: `grant_${Date.now().toString(36)}`, amount, at: Date.now() }, ...grantStore.getSnapshot()]);
  }, []);

  const clearSimulated = useCallback(() => {
    redemptionStore.set(redemptionStore.getSnapshot().filter((r) => r.mode !== "demo"));
    grantStore.set([]);
  }, []);

  const latest = useRef({ summary, active, stockLeft, registration });
  useEffect(() => {
    latest.current = { summary, active, stockLeft, registration };
  });

  const redeem = useCallback(
    async (item: CatalogItem): Promise<RedemptionRecord> => {
      const { summary: s, stockLeft: left } = latest.current;
      const w = walletRef.current;
      if (left(item) <= 0) throw new Error("This reward is unavailable.");
      if (item.cost > s.balance) throw new Error(`Insufficient $MEV balance: ${item.cost} needed, ${s.balance} available.`);
      const address = w.address ?? latest.current.registration?.wallet.address ?? "";
      const base = {
        id: newRef(),
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        group: item.group,
        amount: item.cost,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        wallet: { address, chainId: w.chainId },
        balanceBefore: s.balance,
        balanceAfter: s.balance - item.cost,
      };

      // Always a clearly-labelled simulation: MissionEV.sol has no redeem or burn, so no tokens move and no transaction exists.
      await new Promise((r) => setTimeout(r, 1100));
      const rec: RedemptionRecord = {
        ...base,
        status: "simulated",
        mode: "demo",
        updatedAt: Date.now(),
        voucher: { code: `DEMO-${fnv1a(base.id + item.id).toString(16).toUpperCase().padStart(8, "0")}`, isDemo: true },
      };
      redemptionStore.set([rec, ...redemptionStore.getSnapshot()]);
      return rec;
    },
    [],
  );

  const value = useMemo<RewardsContextValue>(
    () => ({
      summary,
      onchainActive: active,
      checks,
      onchain: snap,
      chainEvents: snap?.events ?? [],
      refreshing,
      chainError,
      gasWei: gasKey && gas?.key === gasKey ? gas.wei : null,
      redemptions,
      stockLeft,
      grantDemo,
      clearSimulated,
      refreshOnchain,
      redeem,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary, active, snap, refreshing, chainError, gas, gasKey, redemptions, stockLeft, grantDemo, clearSimulated, refreshOnchain, redeem, checks.addressConfigured, checks.realWallet, checks.onPortal, checks.codeFound, checks.balanceReadable],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRewards(): RewardsContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRewards must be used inside <RewardsProvider>");
  return v;
}

export { CATALOG };
