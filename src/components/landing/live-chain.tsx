"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { cn, formatNumber, shortAddress } from "@/lib/format";
import type { ChainStatus, ChainVerdict } from "@/server/chainStatus";
import { ageText } from "@/lib/landing/age";

type View = { phase: "loading" } | { phase: "done"; status: ChainStatus } | { phase: "failed" };

const VERDICT: Record<ChainVerdict, { tone: "ok" | "warn" | "err"; label: string }> = {
  live: { tone: "ok", label: "Live" },
  stale: { tone: "warn", label: "Lagging" },
  "wrong-chain": { tone: "err", label: "Wrong chain" },
  "no-contract": { tone: "err", label: "No contract" },
  unreachable: { tone: "err", label: "Unreachable" },
};

/** 18-decimal wei string to a plain number string, without floating point on the digits. */
const mev = (wei: string) => {
  const w = BigInt(wei);
  const base = BigInt("1000000000000000000");
  return `${formatNumber(Number(w / base))}.${((w % base) * BigInt(100) / base).toString().padStart(2, "0")}`;
};

function Fact({ label, children, note, good }: { label: string; children: React.ReactNode; note?: React.ReactNode; good?: boolean | null }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-bg-2/60 p-3.5 sm:p-4">
      <dt className="section-label flex items-center gap-1.5">
        {good === true && <CheckCircle2 aria-hidden className="size-3.5 text-ok" />}
        {good === false && <CircleAlert aria-hidden className="size-3.5 text-warn" />}
        {label}
      </dt>
      <dd className="mt-1.5 text-lg font-semibold tracking-tight break-words">{children}</dd>
      {note && <p className="mt-1 text-xs leading-snug text-muted">{note}</p>}
    </div>
  );
}

/**
 * "Ask the chain, right now": a live, read-only look at Portal V3 and the deployed contract, fetched from /api/chain when it
 * scrolls into view. Nothing here is simulated: if the public RPC is down, that is what it says.
 */
export function LiveChain() {
  const [view, setView] = useState<View>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const host = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/chain", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setView({ phase: "done", status: (await res.json()) as ChainStatus });
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
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void load();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  const s = view.phase === "done" ? view.status : null;
  const v = s ? VERDICT[s.verdict] : null;
  const c = s?.contract ?? null;

  return (
    <section ref={host} aria-labelledby="chain-title" className="rounded-3xl border border-line bg-panel p-5 shadow-panel sm:p-7" data-live-chain data-state={s?.verdict ?? view.phase}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.2em] text-lime uppercase">Live from Portal V3</p>
          <h3 id="chain-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Ask the chain, right now
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            This is not a mock-up. The site&apos;s server reads the real Portal V3 testnet and the deployed contract on every refresh. It is read-only: no wallet, no key, nothing is sent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {v && (
            <Badge tone={v.tone} dot>
              {v.label}
            </Badge>
          )}
          <Button variant="secondary" size="sm" loading={busy} icon={<RefreshCw aria-hidden className="size-3.5" />} onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="mt-6">
        {view.phase === "loading" && (
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Asking the chain">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton h-[92px] rounded-xl" />
            ))}
          </dl>
        )}

        {view.phase === "failed" && (
          <div role="status" className="flex gap-3 rounded-xl border border-warn/40 bg-warn/[0.08] p-4 text-sm">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            <p>
              <span className="font-semibold">Couldn&apos;t ask the chain.</span> This site&apos;s own server did not answer. Press Refresh, or run{" "}
              <code className="font-mono text-xs">npm run contract:verify</code> yourself.
            </p>
          </div>
        )}

        {s && (
          <>
            <p className={cn("mb-4 flex gap-2 text-sm leading-relaxed", s.verdict === "live" ? "text-fg" : "text-warn")} data-chain-message>
              {s.verdict === "live" ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" /> : <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
              {s.message}
            </p>

            {(s.head || c) && (
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {s.head && (
                  <Fact label="Latest block" note={`${ageText(s.head.ageSeconds)} ago`} good={s.head.ageSeconds <= 120}>
                    #{formatNumber(s.head.number)}
                  </Fact>
                )}
                {s.chainId !== null && (
                  <Fact label="Chain id" note={s.chainId === s.expectedChainId ? "Portal V3 testnet, as expected" : `Expected ${s.expectedChainId}`} good={s.chainId === s.expectedChainId}>
                    {s.chainId}
                  </Fact>
                )}
                {c && (
                  <>
                    <Fact label="Contract code" note="Deployed bytecode at the published address" good>
                      {formatNumber(c.codeBytes)} bytes
                    </Fact>
                    <Fact label="Token" note={c.symbol ? `Symbol ${c.symbol}` : undefined}>
                      <span className="text-base">{c.name ?? "Not readable"}</span>
                    </Fact>
                    <Fact label="$MEV minted so far" note={c.totalSupplyWei === null ? undefined : c.totalSupplyWei === "0" ? "No journey has been recorded on-chain yet" : "Total supply, straight from the contract"}>
                      {c.totalSupplyWei === null ? "Not readable" : mev(c.totalSupplyWei)}
                    </Fact>
                    <Fact label="Oracle signer" note="The verifier node's address" good={c.matchesDeploymentRecord}>
                      <span className="font-mono text-base">{c.oracleSigner ? shortAddress(c.oracleSigner) : "Not readable"}</span>
                    </Fact>
                    <Fact label="Owner" note={c.matchesDeploymentRecord === null ? undefined : c.matchesDeploymentRecord ? "Owner and oracle match the deployment record" : "Differs from the deployment record"} good={c.matchesDeploymentRecord}>
                      <span className="font-mono text-base">{c.owner ? shortAddress(c.owner) : "Not readable"}</span>
                    </Fact>
                    <Fact label="EIP-712 domain" note="Recomputed here and compared with the chain" good={c.domainSeparatorOk}>
                      <span className="text-base">{c.domainSeparatorOk === null ? "Not readable" : c.domainSeparatorOk ? "Matches" : "Does not match"}</span>
                    </Fact>
                  </>
                )}
              </dl>
            )}

            <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-muted">
              <CircleDashed aria-hidden className="size-3.5" />
              Read from <code className="font-mono">{s.rpc.replace(/^https?:\/\//, "")}</code> at {new Date(s.checkedAt).toLocaleTimeString()} (answers are cached for up to 15 s). MissionEV uses Portal V3&apos;s EVM layer only; it does not use its native or cross-chain features.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
