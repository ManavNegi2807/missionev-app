"use client";

import { useId, useState } from "react";
import { ExternalLink, FlaskConical, RefreshCw, Ticket } from "lucide-react";
import { Alert, Badge, Button, KV } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/overlay";
import { PORTAL_V3 } from "@/lib/chain";
import { formatNumber, shortAddress } from "@/lib/format";
import { useRewards } from "@/providers/rewards-provider";
import { STATUS_TONE, recordLabel } from "./history-section";

const stamp = (ms: number) => new Date(ms).toLocaleString();

export function DetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const labelId = useId();
  const { redemptions, recheckRecord } = useRewards();
  const [busy, setBusy] = useState(false);
  const r = redemptions.find((x) => x.id === id);
  const link = r?.txHash && PORTAL_V3.explorerUrl ? `${PORTAL_V3.explorerUrl.replace(/\/$/, "")}/tx/${r.txHash}` : null;

  return (
    <Drawer title="Redemption record" eyebrow="D4 · Redemptions" labelId={labelId} onClose={onClose}>
      {!r ? (
        <p className="text-sm text-muted">This record no longer exists (it may have been reset).</p>
      ) : (
        <div className="space-y-5" data-drawer-record={r.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[r.status]} dot>
              {recordLabel(r.status)}
            </Badge>
            <Badge tone={r.mode === "demo" ? "warn" : "ok"}>{r.mode === "demo" ? "Demo · simulated" : "On-chain redeem()"}</Badge>
          </div>

          <div>
            <p className="section-label">{r.category}</p>
            <p className="mt-1 text-lg font-semibold text-fg">{r.itemName}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <KV label="Reference" mono>
              {r.id}
            </KV>
            <KV label="Amount" mono>
              {formatNumber(r.amount)} $MEV
            </KV>
            <KV label="Balance before" mono>
              {formatNumber(r.balanceBefore)} $MEV
            </KV>
            <KV label="Balance after" mono>
              {formatNumber(r.balanceAfter)} $MEV
            </KV>
            <KV label="Created">{stamp(r.createdAt)}</KV>
            <KV label="Updated">{stamp(r.updatedAt)}</KV>
            <KV label="Wallet" mono>
              {shortAddress(r.wallet.address)}
            </KV>
            <KV label="Chain ID" mono>
              {r.wallet.chainId ?? "—"}
            </KV>
          </dl>

          <div className="min-w-0 rounded-xl border border-line bg-bg-2/50 p-3.5">
            <p className="section-label">Transaction</p>
            {r.txHash ? (
              <>
                <p className="mt-1.5 font-mono text-[11px] break-all text-fg">{r.txHash}</p>
                <p className="mt-1 text-xs text-muted">{r.blockNumber ? `Block ${r.blockNumber}` : "No receipt yet."}</p>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan hover:underline">
                    View on explorer <ExternalLink aria-hidden className="size-3" />
                  </a>
                )}
              </>
            ) : (
              <p className="mt-1.5 flex items-start gap-2 text-sm text-muted">
                <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
                No transaction. {r.mode === "demo" ? "This was a simulated redemption; nothing was sent to a blockchain." : "The wallet never returned a hash."}
              </p>
            )}
          </div>

          {r.error && (
            <Alert role="alert" tone="err" title="Error">
              {r.error}
            </Alert>
          )}

          {r.voucher && r.status !== "failed" && (
            <div className="rounded-xl border border-dashed border-warn/50 p-4">
              <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-warn">
                <Ticket aria-hidden className="size-4" /> {r.voucher.isDemo ? "DEMO VOUCHER · NOT REDEEMABLE" : "VOUCHER"}
              </p>
              <p className="mt-2 font-mono text-lg tracking-widest text-fg">{r.voucher.code}</p>
            </div>
          )}

          {r.status === "pending" && r.mode === "onchain" && (
            <Button
              loading={busy}
              icon={<RefreshCw aria-hidden className="size-4" />}
              onClick={async () => {
                setBusy(true);
                try {
                  await recheckRecord(r.id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Check receipt
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}
