"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, FlaskConical, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { WalletError } from "@/components/shell/wallet-error";
import { Alert, Badge, Button, KV, Panel, PanelHeader } from "@/components/ui/primitives";
import { PORTAL_V3 } from "@/lib/chain";
import { formatTimestamp, shortAddress } from "@/lib/format";
import type { RegistrationRecord, SignInInput } from "@/providers/onboarding-provider";
import { DEMO_ADDRESS, useWallet } from "@/providers/wallet-provider";

export function SigninPanel({
  account,
  onSignIn,
  onSignOut,
}: {
  account: RegistrationRecord | null;
  onSignIn: (input: SignInInput) => Promise<void> | void;
  onSignOut: () => void;
}) {
  const w = useWallet();
  const [copied, setCopied] = useState(false);

  const connectMetaMask = async () => {
    const connected = await w.connect();
    if (connected) await onSignIn({ method: "wallet", address: connected.address, chainId: connected.chainId ?? PORTAL_V3.chainId });
  };
  const continueAsDemo = async () => {
    // A demo account never has a wallet behind it, so let go of one that is still attached to this tab.
    if (w.mode === "browser") await w.disconnect();
    await onSignIn({ method: "demo", address: DEMO_ADDRESS, chainId: PORTAL_V3.chainId });
  };

  const copy = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const signedIn = account !== null;
  const isWallet = account?.account.method === "wallet";
  const wrongNetwork = isWallet && w.isConnected && !w.isDemo && !w.onExpectedChain;
  const walletAway = isWallet && !w.isConnected;

  return (
    <Panel aria-labelledby="signin-title">
      <PanelHeader
        id="signin-title"
        eyebrow="Step 1 · Sign in"
        title="Sign in with your wallet"
        subtitle={signedIn ? undefined : "Your wallet address is your account: no password, no phone number, nothing to type."}
        action={
          <Badge tone={signedIn ? "ok" : "cyan"} dot>
            {signedIn ? "Signed in" : "MetaMask"}
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
                <p className="text-sm font-medium text-fg">{isWallet ? "Signed in with MetaMask" : "Signed in with a demo account"}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">{isWallet ? shortAddress(account.wallet.address) : "No wallet · nothing is on-chain"}</p>
              </div>
              {isWallet && (
                <Button variant="ghost" onClick={() => void copy()} icon={copied ? <Check aria-hidden className="size-4 text-ok" /> : <Copy aria-hidden className="size-4" />}>
                  {copied ? "Copied" : "Copy address"}
                </Button>
              )}
              <Button variant="danger" onClick={onSignOut} icon={<LogOut aria-hidden className="size-4" />}>
                Sign out
              </Button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-line bg-bg-2/60 p-4">
              <KV label="Account">{isWallet ? "MetaMask wallet" : "Demo account"}</KV>
              <KV label="User" mono>
                {account.userId}
              </KV>
              <KV label="Network">
                {isWallet
                  ? w.isConnected
                    ? w.onExpectedChain
                      ? `${PORTAL_V3.shortName} · ${PORTAL_V3.chainId}`
                      : `${w.networkName} · ${w.chainId}`
                    : "Wallet not connected"
                  : "Simulated"}
              </KV>
              <KV label="Signed in at">{formatTimestamp(account.account.signedInAt)}</KV>
            </dl>

            {wrongNetwork && (
              <Alert
                role="status"
                tone="warn"
                icon={<AlertTriangle aria-hidden className="size-4" />}
                title="Switch to Portal V3"
                actions={
                  <Button size="sm" variant="primary" onClick={() => void w.switchNetwork()}>
                    Switch to {PORTAL_V3.shortName}
                  </Button>
                }
              >
                Your wallet is on {w.networkName}. MissionEV records trips on {PORTAL_V3.name} (chain {PORTAL_V3.chainId}); your wallet will offer to add it if it is missing.
              </Alert>
            )}
            {walletAway && (
              <Alert
                role="status"
                tone="warn"
                icon={<AlertTriangle aria-hidden className="size-4" />}
                title="Wallet not connected"
                actions={
                  <Button size="sm" variant="primary" loading={w.connecting} icon={<Wallet aria-hidden className="size-3.5" />} onClick={() => void w.connect()}>
                    Reconnect
                  </Button>
                }
              >
                You are still signed in here, but the wallet is not connected in this tab. Reconnect to read your balance or record trips.
              </Alert>
            )}
            <WalletError />
          </>
        ) : (
          <>
            <Button variant="primary" size="lg" loading={w.connecting} icon={<Wallet aria-hidden className="size-4" />} onClick={() => void connectMetaMask()} className="w-full sm:w-auto">
              {w.connecting ? "Waiting for MetaMask…" : "Connect MetaMask"}
            </Button>
            <WalletError />
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
              Connecting shares only your public address. MissionEV never sees your seed phrase or private key and cannot move your funds, and signing in costs no gas.
            </p>

            <div className="space-y-3 border-t border-line pt-4">
              <p className="text-sm leading-relaxed text-muted">No wallet? Look around with a demo account. Everything is simulated and nothing goes on-chain.</p>
              <Button variant="secondary" icon={<FlaskConical aria-hidden className="size-4" />} onClick={() => void continueAsDemo()}>
                Explore with a demo account
              </Button>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
