"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Coins, ExternalLink, FlaskConical, Fuel, Link2, Loader2, PenLine, ShieldCheck, Wallet, XCircle } from "lucide-react";
import { Alert, Badge, Button, KV, Panel } from "@/components/ui/primitives";
import { useIntegrationStatus } from "@/lib/api/client";
import { PORTAL_V3 } from "@/lib/chain";
import { CONTRACT, contractStatus } from "@/lib/contract/config";
import { formatMevWei } from "@/lib/contract/client";
import { cn, shortAddress } from "@/lib/format";
import { formatNative } from "@/lib/rewards/chain";
import { useRewards } from "@/providers/rewards-provider";
import { useTrip } from "@/providers/trip-provider";
import { useWallet } from "@/providers/wallet-provider";

const explorerTx = (hash: string) => (PORTAL_V3.explorerUrl ? `${PORTAL_V3.explorerUrl.replace(/\/$/, "")}/tx/${hash}` : null);

type StepState = "todo" | "active" | "done" | "fail";
function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children?: React.ReactNode }) {
  const icon = state === "done" ? <CheckCircle2 aria-hidden className="size-4 text-ok" /> : state === "fail" ? <XCircle aria-hidden className="size-4 text-err" /> : state === "active" ? <Loader2 aria-hidden className="size-4 animate-spin text-cyan" /> : <CircleDashed aria-hidden className="size-4 text-line-strong" />;
  return (
    <li className={cn("flex gap-3 rounded-xl border p-3", state === "done" ? "border-ok/30" : state === "fail" ? "border-err/30" : state === "active" ? "border-cyan/40" : "border-line")}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">
          <span className="mr-2 font-mono text-[11px] text-muted">{n}</span>
          {title}
        </p>
        {children && <div className="mt-1 text-xs leading-relaxed text-muted [overflow-wrap:anywhere]">{children}</div>}
      </div>
    </li>
  );
}

/** Process 5.0. DEMO journeys are credited in this browser only; LIVE journeys go oracle signature → the commuter's own wallet → the contract. */
export function LedgerPanel() {
  const { record, status, claimDemo, requestSignature, submitOnChain } = useTrip();
  const wallet = useWallet();
  const { gasWei } = useRewards();
  const { status: server } = useIntegrationStatus();
  const [busy, setBusy] = useState<"sign" | "send" | null>(null);
  // 0 until mounted: reading the clock during render would freeze it into the prerendered page.
  const [now, setNow] = useState(0);
  const cs = contractStatus();
  const s = record?.settlement;
  const carbon = record?.carbon ?? null;
  const signed = s?.oracle.signed;

  useEffect(() => {
    if (!signed) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [signed]);

  const verified = status === "VERIFIED" && Boolean(carbon);
  const eligible = Boolean(carbon?.reward.eligible);
  const live = s?.applicationMode === "LIVE";
  const wrongChain = wallet.isConnected && !wallet.isDemo && !wallet.onExpectedChain;
  const real = wallet.mode === "browser";
  const address = record?.wallet.address ?? wallet.address;
  const secondsLeft = signed && now ? Math.max(0, signed.deadline - Math.floor(now / 1000)) : null;
  const expired = secondsLeft === 0 && s?.phase !== "confirmed";
  const preview = s?.preview?.rewardMev ?? null;
  const signMismatch = signed && carbon && signed.co2AvoidedGrams !== carbon.co2AvoidedGrams;

  const oracleState: StepState = s?.oracle.status === "signed" ? "done" : s?.oracle.status === "requesting" ? "active" : s?.oracle.status === "refused" || s?.oracle.status === "error" || s?.oracle.status === "unavailable" ? "fail" : "todo";
  const txState: StepState = s?.tx.status === "confirmed" ? "done" : s?.tx.status === "pending" || s?.tx.status === "awaiting-wallet" ? "active" : s?.tx.status === "reverted" || s?.tx.status === "rejected" || s?.tx.status === "error" ? "fail" : "todo";

  return (
    <Panel aria-labelledby="ledger-title" className="border-lime/20">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="section-label mb-1">Process 5.0 · Record on-chain → D3</p>
          <h2 id="ledger-title" className="text-[15px] font-semibold tracking-[0.06em] uppercase">
            Portal Layer 0 / smart contract ledger
          </h2>
        </div>
        <Badge tone={live ? "ok" : "warn"} dot>
          {!s || s.phase === "not-started" ? (live ? "Live" : "Demo") : live ? "Live · on-chain flow" : "Demo · not on-chain"}
        </Badge>
      </header>

      <div className="space-y-5 p-4 sm:p-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <KV label="Commuter wallet" mono>
            {address ? shortAddress(address) : "—"}
          </KV>
          <KV label="Portal network">{wallet.isConnected ? (wallet.isDemo ? `${PORTAL_V3.name} (demo)` : wallet.networkName) : PORTAL_V3.name}</KV>
          <KV label="Chain ID" mono>
            {(wallet.isConnected ? wallet.chainId : record?.wallet.chainId) ?? "—"} <span className="text-muted">/ {PORTAL_V3.chainId}</span>
          </KV>
          <KV label="Contract">
            <span className={cs.kind === "address-set" ? "text-ok" : "text-warn"}>{cs.kind === "address-set" ? shortAddress(CONTRACT.address) : cs.label}</span>
          </KV>
        </dl>

        {wrongChain && (
          <Alert tone="warn" role="alert" icon={<AlertTriangle aria-hidden className="size-4" />} title="Wrong network" actions={wallet.canAddChain || true ? <Button size="sm" variant="primary" onClick={() => void wallet.switchNetwork()}>Switch to {PORTAL_V3.shortName}</Button> : undefined}>
            Your wallet is on chain {wallet.chainId}; Portal V3 is {PORTAL_V3.chainId}. Switch it in your wallet before any on-chain step.
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-bg-2/60 p-3.5">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted">
              <Fuel aria-hidden className="size-4" /> GAS · {CONTRACT.gasSymbol}
            </p>
            <p className="mt-2 font-mono text-lg text-cyan">{gasWei ? formatNative(gasWei) : "—"}</p>
            <p className="mt-1 text-xs text-muted">Native Portal currency. You pay it to send <span className="font-mono">recordCommute</span> from your own wallet; it is not $MEV.</p>
          </div>
          <div className="rounded-xl border border-line bg-bg-2/60 p-3.5">
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted">
              <Coins aria-hidden className="size-4" /> REWARD · {CONTRACT.rewardSymbol}
            </p>
            <p className="mt-2 font-mono text-lg text-lime">
              {s?.onchain ? formatMevWei(s.onchain.mintedWei) : preview !== null && eligible ? preview.toFixed(2) : "—"}{" "}
              <span className="text-xs text-muted">{s?.onchain ? "minted (read from the chain)" : "preview only"}</span>
            </p>
            <p className="mt-1 text-xs text-muted">{s?.onchain ? `New balance ${formatMevWei(s.onchain.balanceWei)} MEV.` : "Nothing is minted until the contract confirms the transaction."}</p>
          </div>
        </div>

        {!verified && <p className="text-center text-xs text-muted">Available after a trip is verified.</p>}

        {verified && !eligible && (
          <Alert tone="neutral" icon={<Link2 aria-hidden className="size-4" />} title="Nothing to record">
            {carbon!.reward.reason}
          </Alert>
        )}

        {verified && eligible && !live && (
          <div className="space-y-3">
            <Alert
              tone="warn"
              icon={<FlaskConical aria-hidden className="size-4" />}
              title="Demo journey — not on-chain"
              actions={
                server?.mode === "LIVE" && record?.source === "gps" ? (
                  wallet.mode === "browser" && !wallet.onExpectedChain ? (
                    <Button size="sm" variant="primary" onClick={() => void wallet.switchNetwork()}>
                      Switch to {PORTAL_V3.shortName}
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" loading={wallet.connecting} icon={<Wallet aria-hidden className="size-3.5" />} onClick={() => void wallet.connect()}>
                      Connect wallet
                    </Button>
                  )
                ) : undefined
              }
            >
              {record?.source === "simulated"
                ? "Simulated trips are demo data and are never signed or sent to the chain."
                : server?.mode === "LIVE"
                  ? `The server is set up for the real chain. Connect a wallet on ${PORTAL_V3.name} to record this journey: you sign a free request, the oracle verifies it, then you send the transaction. Until then this credit exists only in this browser tab.`
                  : "Recording for real needs a fully configured server (contract address, RPC URL and oracle key) and a wallet connected on Portal V3. Until then this credit exists only in this browser tab."}
            </Alert>
            {s?.phase === "demo-credited" ? (
              <p role="status" className="text-sm text-fg">
                <CheckCircle2 aria-hidden className="mr-1.5 inline size-4 text-ok" />
                Credited <span className="font-mono text-lime">{(s.demo?.creditedMev ?? 0).toFixed(2)} $MEV</span> in the demo. No transaction exists and nothing was minted.
              </p>
            ) : (
              <Button variant="primary" size="lg" className="w-full" icon={<FlaskConical aria-hidden className="size-4" />} onClick={claimDemo}>
                Credit demo reward — not on-chain
              </Button>
            )}
          </div>
        )}

        {verified && eligible && live && (
          <div className="space-y-4">
            {!real || !wallet.address ? (
              <Alert tone="cyan" icon={<Wallet aria-hidden className="size-4" />} title="Connect your wallet" actions={<Button size="sm" variant="primary" loading={wallet.connecting} onClick={() => void wallet.connect()}>Connect wallet</Button>}>
                The contract credits whoever sends the transaction, so recording happens from your own wallet.
              </Alert>
            ) : null}

            <ol className="space-y-2" aria-label="Recording steps">
              <Step n={1} title="Journey verified" state="done">
                {record?.verification?.trust.tier} tier · {carbon!.co2AvoidedGrams} g avoided · {carbon!.distanceMeters} m
              </Step>
              <Step n={2} title="Oracle verification & EIP-712 signature" state={oracleState}>
                {s?.oracle.status === "requesting" && "Waiting for your wallet's free signature, then the oracle re-verifies the trip and recalculates the emissions itself…"}
                {s?.oracle.status === "signed" && "The oracle recalculated this journey and signed the values below. It signs what it derived, never numbers from your browser."}
                {(s?.oracle.status === "refused" || s?.oracle.status === "error" || s?.oracle.status === "unavailable") && <span className="text-err">{s.oracle.reason}</span>}
                {s?.oracle.status === "not-requested" && "Not requested yet. Your wallet signs a free message so the oracle knows the request is yours."}
              </Step>
              <Step n={3} title="Record from your wallet (recordCommute)" state={txState}>
                {s?.tx.status === "awaiting-wallet" && "Confirm the transaction in your wallet…"}
                {s?.tx.status === "pending" && "Submitted. Waiting for the chain to confirm…"}
                {s?.tx.status === "confirmed" && "Confirmed. The numbers below were read back from the contract."}
                {(s?.tx.status === "reverted" || s?.tx.status === "rejected" || s?.tx.status === "error") && <span className="text-err">{s.tx.error}</span>}
                {s?.tx.hash && (
                  <span className="mt-1 block font-mono text-[11px] break-all">
                    {s.tx.hash}{" "}
                    {explorerTx(s.tx.hash) && (
                      <a href={explorerTx(s.tx.hash)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan hover:underline">
                        explorer <ExternalLink aria-hidden className="size-3" />
                      </a>
                    )}
                  </span>
                )}
              </Step>
            </ol>

            {signed && (
              <div className="space-y-3 rounded-xl border border-cyan/30 bg-cyan/[0.04] p-4">
                <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-cyan">
                  <PenLine aria-hidden className="size-3.5" /> SIGNED PAYLOAD · TripPayload (EIP-712)
                </p>
                <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <KV label="Mode" mono>
                    {signed.modeName} ({signed.mode})
                  </KV>
                  <KV label="Distance (m)" mono>
                    {signed.distanceMeters}
                  </KV>
                  <KV label="co2AvoidedGrams" mono>
                    {signed.co2AvoidedGrams}
                  </KV>
                  <KV label="Nonce" mono>
                    {signed.nonce}
                  </KV>
                  <KV label="Expires" mono>
                    {expired ? "expired" : secondsLeft === null ? "…" : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
                  </KV>
                  <KV label="Oracle" mono>
                    {shortAddress(signed.oracle)}
                  </KV>
                </dl>
                <div className="min-w-0">
                  <p className="section-label">Trip id · 32 bytes</p>
                  <p className="mt-1 font-mono text-[11px] break-all text-fg">{signed.tripId}</p>
                </div>
                <div className="min-w-0">
                  <p className="section-label">Signature · r ‖ s ‖ v (65 bytes)</p>
                  <p className="mt-1 max-h-16 overflow-y-auto font-mono text-[11px] break-all text-muted">{signed.signature}</p>
                </div>
                {signMismatch && (
                  <p className="text-xs text-warn">The oracle signed {signed.co2AvoidedGrams} g, not the {carbon!.co2AvoidedGrams} g on your screen, because it recalculated from the location samples it received. The signed value is the one that counts.</p>
                )}
              </div>
            )}

            {s?.phase === "confirmed" && s.onchain && (
              <div role="status" className="space-y-2 rounded-xl border border-ok/40 bg-ok/[0.06] p-4">
                <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-ok">
                  <ShieldCheck aria-hidden className="size-4" /> CONFIRMED ON PORTAL · READ BACK FROM THE CONTRACT
                </p>
                <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <KV label="Minted" mono>
                    {formatMevWei(s.onchain.mintedWei)} MEV
                  </KV>
                  <KV label="Balance" mono>
                    {formatMevWei(s.onchain.balanceWei)} MEV
                  </KV>
                  <KV label="Streak" mono>
                    {s.onchain.streakDays} d
                  </KV>
                  <KV label="Carbon score" mono>
                    {s.onchain.carbonScore}
                  </KV>
                </dl>
              </div>
            )}

            {s?.phase !== "confirmed" && (
              <div className="flex flex-col gap-2 sm:flex-row">
                {(!signed || expired || s?.oracle.status !== "signed") && (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!real || !wallet.address || wrongChain || s?.oracle.status === "requesting"}
                    loading={busy === "sign" || s?.oracle.status === "requesting"}
                    icon={<PenLine aria-hidden className="size-4" />}
                    onClick={async () => {
                      setBusy("sign");
                      try {
                        await requestSignature();
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {signed && expired ? "Request a fresh signature" : "Verify & get oracle signature"}
                  </Button>
                )}
                {signed && !expired && s?.oracle.status === "signed" && (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!real || wrongChain || s?.tx.status === "pending" || s?.tx.status === "awaiting-wallet"}
                    loading={busy === "send" || s?.tx.status === "pending" || s?.tx.status === "awaiting-wallet"}
                    icon={<Link2 aria-hidden className="size-4" />}
                    onClick={async () => {
                      setBusy("send");
                      try {
                        await submitOnChain();
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Record on Portal from my wallet
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted">
          How it works: the oracle (an Azure service) signs the trip; <strong className="text-fg">your wallet</strong> sends it, because the contract credits <span className="font-mono">msg.sender</span>. A DEMO result is never labelled as an on-chain transaction.
        </p>
      </div>
    </Panel>
  );
}
