"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { formatMevWei } from "@/lib/contract/client";
import { shortAddress } from "@/lib/format";
import { ageText } from "@/lib/landing/age";
import type { ActivityResult } from "@/server/activity";

type View = { phase: "loading" } | { phase: "done"; result: ActivityResult } | { phase: "failed" };

const MODE_LABEL: Record<string, string> = {
  EV_CAR: "EV car",
  EV_2W: "EV two-wheeler",
  METRO: "Metro",
  EBUS: "Electric bus",
  ACTIVE: "Walking / cycling",
  ICE_CAR: "Petrol/diesel car",
  ICE_SUV: "Petrol/diesel SUV",
};

/**
 * "Recent on-chain activity": the latest recordCommute outcomes, read by this site's server from the deployed contract's event
 * logs (GET /api/activity). Read-only: no wallet, no key. Rows exist only if the chain returned them; an empty chain or a
 * failing RPC is said plainly. An on-chain row proves a transaction happened, not that the journey behind it was real travel:
 * a testnet demo trip looks the same on-chain, which is why the panel says so.
 */
export function RecentActivity() {
  const [view, setView] = useState<View>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const host = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setView({ phase: "done", result: (await res.json()) as ActivityResult });
    } catch {
      setView({ phase: "failed" });
    } finally {
      setBusy(false);
    }
  }, []);

  // Ask once, when the panel first comes into view (immediately where IntersectionObserver is missing).
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      void load();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void load();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  const r = view.phase === "done" ? view.result : null;
  const nowSec = r ? Math.round(r.checkedAt / 1000) : 0;

  return (
    <section ref={host} aria-labelledby="activity-title" className="rounded-3xl border border-line bg-panel p-5 shadow-panel sm:p-7" data-recent-activity data-state={r?.verdict ?? view.phase}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.2em] text-lime uppercase">Read from the contract&apos;s logs</p>
          <h3 id="activity-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Recent on-chain activity
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            The latest <span className="font-mono text-xs">recordCommute</span> transactions on the deployed contract, read-only: no wallet, no key. A row proves a transaction happened. It does not prove the journey behind it was real travel: testnet demo trips, where a deployment allows them, look the same on-chain.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {r && (
            <Badge tone={r.verdict === "ok" ? "ok" : r.verdict === "empty" ? "neutral" : "err"} dot>
              {r.verdict === "ok" ? `${r.events.length} shown` : r.verdict === "empty" ? "None yet" : "Unreachable"}
            </Badge>
          )}
          <Button variant="secondary" size="sm" loading={busy} icon={<RefreshCw aria-hidden className="size-3.5" />} onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="mt-6">
        {view.phase === "loading" && (
          <div className="space-y-2" aria-busy="true" aria-label="Reading recent activity">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        )}

        {view.phase === "failed" && (
          <div role="status" className="flex gap-3 rounded-xl border border-warn/40 bg-warn/[0.08] p-4 text-sm">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            <p>
              <span className="font-semibold">Couldn&apos;t read recent activity.</span> This site&apos;s own server did not answer. Press Refresh in a moment.
            </p>
          </div>
        )}

        {r && r.verdict !== "ok" && (
          <div role="status" className={`flex gap-3 rounded-xl border p-4 text-sm ${r.verdict === "unreachable" ? "border-warn/40 bg-warn/[0.08]" : "border-line bg-bg-2/60"}`} data-activity-message>
            {r.verdict === "unreachable" && <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />}
            <p>{r.message}</p>
          </div>
        )}

        {r && r.verdict === "ok" && (
          <>
            <p className="mb-3 text-xs text-muted">
              {r.message}
              {!r.complete && r.fromBlock !== null && ` Blocks ${r.fromBlock.toLocaleString("en-US")} onward were searched; older activity, if any, isn't shown.`}
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" data-activity-list>
              {r.events.map((e) => (
                <li key={`${e.txHash}:${e.logIndex}`} className="grid grid-cols-2 items-center gap-x-4 gap-y-1.5 bg-bg-2/40 px-3.5 py-3 sm:grid-cols-[1fr_1.1fr_0.9fr_0.9fr_0.9fr_auto] sm:px-4">
                  <p className="font-mono text-xs text-fg" title={e.commuter}>
                    {shortAddress(e.commuter)}
                  </p>
                  <p className="text-right text-xs sm:text-left">{MODE_LABEL[e.modeName] ?? e.modeName}</p>
                  <p className="font-mono text-xs">
                    {e.co2AvoidedGrams.toLocaleString("en-US")} g<span className="block text-[11px] text-muted">CO₂ avoided</span>
                  </p>
                  <p className="text-right font-mono text-xs sm:text-left">
                    {e.mintedWei === null ? "—" : `${formatMevWei(e.mintedWei)} $MEV`}
                    <span className="block text-[11px] text-muted">minted</span>
                  </p>
                  <p className="font-mono text-xs text-muted">{e.timestamp === null ? `block ${e.blockNumber.toLocaleString("en-US")}` : `${ageText(Math.max(0, nowSec - e.timestamp))} ago`}</p>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-end gap-1 text-xs text-cyan hover:underline"
                    aria-label={`Open transaction ${e.txHash} (${r.linkKind})`}
                  >
                    {r.linkKind === "explorer" ? "explorer" : "indexer"} <ExternalLink aria-hidden className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
