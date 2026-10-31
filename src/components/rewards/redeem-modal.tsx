"use client";

import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FlaskConical, Loader2, Ticket, XCircle } from "lucide-react";
import { Alert, Badge, Button, KV } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/overlay";
import { PORTAL_V3 } from "@/lib/chain";
import { cn, formatNumber, shortAddress } from "@/lib/format";
import { availability, type CatalogItem } from "@/lib/rewards/catalog";
import type { RedemptionRecord } from "@/lib/rewards/types";
import { useOnboarding } from "@/providers/onboarding-provider";
import { useRewards } from "@/providers/rewards-provider";
import { useWallet } from "@/providers/wallet-provider";
import { RewardIcon } from "./reward-icons";

type Phase = "review" | "processing" | "done" | "error";

const explorerTx = (hash: string) => (PORTAL_V3.explorerUrl ? `${PORTAL_V3.explorerUrl.replace(/\/$/, "")}/tx/${hash}` : null);

function friendly(e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? Number((e as { code: unknown }).code) : undefined;
  if (code === 4001) return "You rejected the request in your wallet. No tokens were burned and no record was created.";
  if (code === -32002) return "A request is already open in your wallet. Check the extension.";
  return e instanceof Error ? e.message : "The redemption could not be completed.";
}

export function RedeemModal({
  item,
  onClose,
  onViewRecord,
  notify,
}: {
  item: CatalogItem;
  onClose: () => void;
  onViewRecord: (id: string) => void;
  notify: (t: { tone: "ok" | "err" | "info"; title: string; text?: string }) => void;
}) {
  const labelId = useId();
  const { summary, onchainActive, stockLeft, redeem } = useRewards();
  const wallet = useWallet();
  const { registration } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("review");
  const [result, setResult] = useState<RedemptionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const left = stockLeft(item);
  const av = availability(left);
  const balance = summary.balance;
  const remaining = balance - item.cost;
  const insufficient = remaining < 0;
  const unavailable = left <= 0;
  const address = wallet.address ?? registration?.wallet.address ?? null;
  const chainId = wallet.chainId ?? registration?.wallet.chainId ?? null;
  const live = onchainActive;

  async function confirm() {
    setPhase("processing");
    setError(null);
    try {
      const rec = await redeem(item);
      setResult(rec);
      setPhase("done");
      if (rec.status === "simulated") notify({ tone: "info", title: "Demo redemption recorded", text: `${rec.itemName} · ${rec.id} (simulated — no tokens moved)` });
      else notify({ tone: "err", title: "Redemption failed", text: rec.error });
    } catch (e) {
      const msg = friendly(e);
      setError(msg);
      setPhase("error");
      notify({ tone: "err", title: "Redemption not completed", text: msg });
    }
  }

  const busy = phase === "processing";

  return (
    <Modal title="Confirm redemption" eyebrow="Process 6.0 → D4" labelId={labelId} onClose={onClose} dismissable={!busy}>
      {phase === "review" || phase === "processing" || phase === "error" ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-2/60 p-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-lime/30 text-lime">
              <RewardIcon kind={item.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="section-label">{item.category}</p>
              <p className="truncate text-[15px] font-semibold text-fg">{item.name}</p>
              <p className="text-xs text-muted">{av.label}</p>
            </div>
            <Badge tone="warn">Demo item</Badge>
          </div>

          <dl className="divide-y divide-line/60 rounded-xl border border-line px-4">
            <Row label="Redemption cost" value={`${formatNumber(item.cost)} $MEV`} />
            <Row
              label="Available $MEV balance"
              value={`${formatNumber(balance)} $MEV`}
              note={live ? "on-chain balanceOf" : "DEMO BALANCE — not a live token balance"}
              noteTone={live ? "ok" : "warn"}
            />
            <Row label="Remaining after redemption" value={insufficient ? "—" : `${formatNumber(remaining)} $MEV`} danger={insufficient} />
          </dl>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <KV label="Wallet" mono>
              {address ? shortAddress(address) : "—"}
            </KV>
            <KV label="Network">{live ? wallet.networkName : `${PORTAL_V3.name}${wallet.isDemo || !wallet.isConnected ? " (demo)" : ""}`}</KV>
            <KV label="Chain ID" mono>
              {chainId ?? "—"} <span className="text-muted">/ {PORTAL_V3.chainId}</span>
            </KV>
            <KV label="Gas">None: no transaction is sent</KV>
          </dl>

          <Alert tone="warn" icon={<FlaskConical aria-hidden className="size-4" />} title="Demo redemption">
            Simulated. The MissionEV contract has no redeem or burn function, so no tokens move and no transaction is created, and the voucher isn&apos;t redeemable anywhere.
            {live && " Your on-chain balance is unchanged; the amount is only subtracted from what this screen offers you."} A local D4 record is saved in this tab.
          </Alert>

          {insufficient && !unavailable && (
            <Alert role="alert" tone="err" icon={<AlertTriangle aria-hidden className="size-4" />} title="Insufficient $MEV balance">
              You need {formatNumber(item.cost - balance)} more $MEV for this reward.
              {!live && " In demo mode you can add demo $MEV from the balance panel or record a verified trip on Screen 02."}
            </Alert>
          )}
          {unavailable && (
            <Alert role="alert" tone="err" icon={<AlertTriangle aria-hidden className="size-4" />} title="Reward unavailable">
              No demo stock is left for this reward.
            </Alert>
          )}
          {phase === "error" && error && (
            <Alert role="alert" tone="err" icon={<XCircle aria-hidden className="size-4" />} title="Not completed">
              {error}
            </Alert>
          )}

          {busy && (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-cyan/30 bg-cyan/[0.05] p-3.5">
              <Loader2 aria-hidden className="size-5 shrink-0 animate-spin text-cyan" />
              <div className="min-w-0 text-sm">
                <p className="text-cyan">Recording simulated redemption…</p>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" data-autofocus disabled={insufficient || unavailable || busy} loading={busy} onClick={confirm}>
              Confirm demo redemption
            </Button>
          </div>
        </div>
      ) : (
        <Done
          rec={result!}
          onClose={onClose}
          onView={() => {
            onViewRecord(result!.id);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

function Row({ label, value, note, noteTone, danger }: { label: string; value: string; note?: string; noteTone?: "ok" | "warn"; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="min-w-0 text-sm text-muted">
        {label}
        {note && <span className={cn("block font-mono text-[10.5px] tracking-wide", noteTone === "ok" ? "text-ok" : "text-warn")}>{note}</span>}
      </dt>
      <dd className={cn("shrink-0 font-mono text-sm", danger ? "text-err" : "text-fg")}>{value}</dd>
    </div>
  );
}

function Done({ rec, onClose, onView }: { rec: RedemptionRecord; onClose: () => void; onView: () => void }) {
  const sim = rec.status === "simulated";
  const ok = rec.status === "completed";
  const failed = rec.status === "failed";
  const link = rec.txHash ? explorerTx(rec.txHash) : null;
  return (
    <div className="space-y-5" role="status">
      <div className={cn("flex items-start gap-3 rounded-xl border p-4", failed ? "border-err/40 bg-err/[0.06]" : sim ? "border-warn/40 bg-warn/[0.06]" : ok ? "border-ok/40 bg-ok/[0.06]" : "border-cyan/40 bg-cyan/[0.06]")}>
        {failed ? <XCircle aria-hidden className="size-6 shrink-0 text-err" /> : <CheckCircle2 aria-hidden className={cn("size-6 shrink-0", sim ? "text-warn" : ok ? "text-ok" : "text-cyan")} />}
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted">{sim ? "DEMO · SIMULATED" : ok ? "CONFIRMED ON-CHAIN" : failed ? "TRANSACTION FAILED" : "SUBMITTED · AWAITING CONFIRMATION"}</p>
          <p className="mt-1 text-lg font-semibold text-fg">{sim ? "Demo redemption complete" : ok ? "Redemption confirmed" : failed ? "Redemption failed" : "Transaction pending"}</p>
          <p className="mt-1 text-sm text-muted">
            {sim
              ? "No tokens were transferred and no blockchain transaction exists. This is a local D4 record."
              : ok
                ? `${formatNumber(rec.amount)} $MEV was burned by the contract.`
                : failed
                  ? (rec.error ?? "The transaction did not succeed. Your balance is unchanged.")
                  : "The wallet submitted the transaction. You can re-check its status from the history."}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <KV label="Reward">{rec.itemName}</KV>
        <KV label="Amount" mono>
          {formatNumber(rec.amount)} $MEV
        </KV>
        <KV label="Reference" mono>
          {rec.id}
        </KV>
        <KV label="Status">{rec.status.toUpperCase()}</KV>
      </dl>

      {rec.txHash ? (
        <div className="min-w-0">
          <p className="section-label">Transaction hash (returned by your wallet)</p>
          <p className="mt-1 font-mono text-[11px] break-all text-fg">{rec.txHash}</p>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan hover:underline">
              View on explorer <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">Transaction hash: none{sim ? " — simulated redemptions never produce one." : "."}</p>
      )}

      {rec.voucher && !failed && (
        <div className="rounded-xl border border-dashed border-warn/50 bg-bg-2/60 p-4">
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-warn">
            <Ticket aria-hidden className="size-4" /> DEMO VOUCHER · NOT REDEEMABLE
          </p>
          <p className="mt-2 font-mono text-lg tracking-widest text-fg">{rec.voucher.code}</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" data-autofocus onClick={onView}>
          View D4 record
        </Button>
      </div>
    </div>
  );
}
