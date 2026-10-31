"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { PORTAL_V3, canAddPortalChain, chainName, toHexChainId } from "@/lib/chain";

/* ---------- minimal EIP-1193 typings ---------- */
interface EthereumProvider {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export type WalletMode = "none" | "browser" | "demo";
export type WalletErrorCode =
  | "no-wallet"
  | "rejected"
  | "request-pending"
  | "failed"
  | "disconnected"
  | "chain-missing"
  | "switch-rejected";

export interface WalletError {
  code: WalletErrorCode;
  message: string;
}

/** Clearly synthetic address used by demo mode (never a real account). */
export const DEMO_ADDRESS = `0xde${"0".repeat(32)}de0001`;

export interface WalletContextValue {
  mode: WalletMode;
  connecting: boolean;
  address: string | null;
  chainId: number | null;
  connectedAt: number | null;
  error: WalletError | null;
  /** Whether an injected wallet was detected in this browser. */
  hasInjected: boolean;
  isMetaMask: boolean;
  isConnected: boolean;
  isDemo: boolean;
  onExpectedChain: boolean;
  networkName: string;
  canAddChain: boolean;
  /** Raw EIP-1193 request through the connected browser wallet. Rejects when no real wallet is connected. */
  request(method: string, params?: unknown[]): Promise<unknown>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  switchNetwork(): Promise<void>;
  enterDemo(): void;
  clearError(): void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const CONNECTED_FLAG = "missionev:wallet:connected";
const setConnectedFlag = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(CONNECTED_FLAG, "1");
    else sessionStorage.removeItem(CONNECTED_FLAG);
  } catch {
    /* storage blocked: the wallet just won't be restored after a reload */
  }
};

function pickProvider(): EthereumProvider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const eth = window.ethereum;
  if (eth.providers?.length) return eth.providers.find((p) => p.isMetaMask) ?? eth.providers[0];
  return eth;
}

/* Wallets can inject after first paint, so detection subscribes to EIP-6963/legacy init events. */
function subscribeInjected(cb: () => void) {
  window.addEventListener("ethereum#initialized", cb);
  const t = setTimeout(cb, 1000);
  return () => {
    window.removeEventListener("ethereum#initialized", cb);
    clearTimeout(t);
  };
}
const getInjected = () => pickProvider() !== null;
const getInjectedServer = () => false;

const parseChainId = (hex: unknown): number | null => {
  if (typeof hex !== "string") return null;
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : null;
};

const rpcCode = (e: unknown): number | undefined =>
  typeof e === "object" && e !== null && "code" in e ? Number((e as { code: unknown }).code) : undefined;

export function WalletProvider({ children }: { children: ReactNode }) {
  const hasInjected = useSyncExternalStore(subscribeInjected, getInjected, getInjectedServer);
  const [mode, setMode] = useState<WalletMode>("none");
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const providerRef = useRef<EthereumProvider | null>(null);

  const reset = useCallback(() => {
    setMode("none");
    setAddress(null);
    setChainId(null);
    setConnectedAt(null);
  }, []);

  /**
   * A page reload drops React state but not the wallet's own authorization. If this tab had connected a wallet (and the
   * commuter hasn't disconnected it), re-attach silently with `eth_accounts`, which never opens a prompt.
   */
  useEffect(() => {
    if (!hasInjected || mode !== "none") return;
    let was = false;
    try {
      was = sessionStorage.getItem(CONNECTED_FLAG) === "1";
    } catch {
      /* storage blocked */
    }
    const provider = pickProvider();
    if (!was || !provider) return;
    let cancelled = false;
    void (async () => {
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      if (cancelled || !accounts?.length) return;
      const chain = parseChainId(await provider.request({ method: "eth_chainId" }));
      if (cancelled) return;
      providerRef.current = provider;
      setAddress(accounts[0]);
      setChainId(chain);
      setConnectedAt(Date.now());
      setMode("browser");
    })().catch(() => {
      /* stay disconnected; the commuter can connect again */
    });
    return () => {
      cancelled = true;
    };
  }, [hasInjected, mode]);

  /* Live account / chain updates while a browser wallet is connected. */
  useEffect(() => {
    if (mode !== "browser") return;
    const provider = providerRef.current;
    if (!provider?.on) return;

    const onAccounts = (accounts: string[]) => {
      if (!accounts.length) {
        reset();
        setError({ code: "disconnected", message: "Your wallet was disconnected or locked. Reconnect to continue." });
      } else {
        setAddress(accounts[0]);
        setConnectedAt(Date.now());
      }
    };
    const onChain = (hex: string) => setChainId(parseChainId(hex));
    const onDisconnect = () => {
      reset();
      setError({ code: "disconnected", message: "The wallet lost its connection to the network." });
    };

    provider.on("accountsChanged", onAccounts as never);
    provider.on("chainChanged", onChain as never);
    provider.on("disconnect", onDisconnect as never);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts as never);
      provider.removeListener?.("chainChanged", onChain as never);
      provider.removeListener?.("disconnect", onDisconnect as never);
    };
  }, [mode, reset]);

  const connect = useCallback(async () => {
    setError(null);
    const provider = pickProvider();
    if (!provider) {
      setError({
        code: "no-wallet",
        message: "No browser wallet detected. Install MetaMask, then reload this page — or continue in demo mode.",
      });
      return;
    }
    setConnecting(true);
    try {
      // Only ever invoked from a user click.
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.length) throw Object.assign(new Error("No accounts returned"), { code: -1 });
      const chain = parseChainId(await provider.request({ method: "eth_chainId" }));
      providerRef.current = provider;
      setAddress(accounts[0]);
      setChainId(chain);
      setConnectedAt(Date.now());
      setMode("browser");
      setConnectedFlag(true);
    } catch (e) {
      const code = rpcCode(e);
      if (code === 4001) {
        setError({ code: "rejected", message: "Connection request rejected. Approve it in your wallet to continue." });
      } else if (code === -32002) {
        setError({ code: "request-pending", message: "A connection request is already open in your wallet. Check the extension." });
      } else {
        setError({ code: "failed", message: "Couldn't connect to the wallet. Unlock it and try again." });
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = providerRef.current;
    const wasBrowser = mode === "browser";
    setConnectedFlag(false);
    reset();
    setError(null);
    if (wasBrowser && provider) {
      // Best effort: not every wallet supports revoking site permissions.
      try {
        await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
      } catch {
        /* ignore */
      }
    }
    providerRef.current = null;
  }, [mode, reset]);

  const switchNetwork = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    setError(null);
    const hex = toHexChainId(PORTAL_V3.chainId);
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
      setChainId(parseChainId(await provider.request({ method: "eth_chainId" })));
    } catch (e) {
      const code = rpcCode(e);
      if (code === 4902 || code === -32603) {
        if (!canAddPortalChain()) {
          setError({
            code: "chain-missing",
            message: `${PORTAL_V3.name} (chain ${PORTAL_V3.chainId}) isn't in your wallet yet. Add it manually, or set NEXT_PUBLIC_PORTAL_RPC_URL and NEXT_PUBLIC_PORTAL_CURRENCY_SYMBOL so MissionEV can request it.`,
          });
          return;
        }
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hex,
                chainName: PORTAL_V3.name,
                rpcUrls: [PORTAL_V3.rpcUrl],
                nativeCurrency: { name: PORTAL_V3.currencySymbol, symbol: PORTAL_V3.currencySymbol, decimals: 18 },
                ...(PORTAL_V3.explorerUrl ? { blockExplorerUrls: [PORTAL_V3.explorerUrl] } : {}),
              },
            ],
          });
          setChainId(parseChainId(await provider.request({ method: "eth_chainId" })));
        } catch (addErr) {
          setError({
            code: rpcCode(addErr) === 4001 ? "switch-rejected" : "failed",
            message: "The network wasn't added. Approve the request in your wallet to switch.",
          });
        }
      } else if (code === 4001) {
        setError({ code: "switch-rejected", message: "Network switch rejected in your wallet." });
      } else {
        setError({ code: "failed", message: "Couldn't switch networks. Switch manually in your wallet." });
      }
    }
  }, []);

  const enterDemo = useCallback(() => {
    providerRef.current = null;
    setError(null);
    setMode("demo");
    setAddress(DEMO_ADDRESS);
    setChainId(PORTAL_V3.chainId);
    setConnectedAt(Date.now());
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const request = useCallback(async (method: string, params?: unknown[]) => {
    const p = providerRef.current;
    if (!p) throw new Error("No browser wallet is connected.");
    return p.request({ method, params });
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      mode,
      connecting,
      address,
      chainId,
      connectedAt,
      error,
      hasInjected,
      isMetaMask: hasInjected && Boolean(pickProvider()?.isMetaMask),
      isConnected: mode !== "none" && address !== null,
      isDemo: mode === "demo",
      onExpectedChain: chainId === PORTAL_V3.chainId,
      networkName: chainName(chainId),
      canAddChain: canAddPortalChain(),
      request,
      connect,
      disconnect,
      switchNetwork,
      enterDemo,
      clearError,
    }),
    [mode, connecting, address, chainId, connectedAt, error, hasInjected, request, connect, disconnect, switchNetwork, enterDemo, clearError],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
