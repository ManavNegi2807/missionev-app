"use client";

import { ArrowRight, Building2, Database, FileSpreadsheet, Server } from "lucide-react";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/format";
import { labelDateTime } from "@/lib/analytics/time";
import type { AnalyticsDataset } from "@/lib/analytics/types";
import { useRewards } from "@/providers/rewards-provider";

type State = "connected" | "session" | "demo" | "unavailable" | "off";
const STATE: Record<State, { tone: "ok" | "neutral" | "warn" | "err"; text: string }> = {
  connected: { tone: "ok", text: "Connected" },
  session: { tone: "neutral", text: "Session + demo" },
  demo: { tone: "warn", text: "Demo" },
  unavailable: { tone: "err", text: "Unavailable" },
  off: { tone: "neutral", text: "Not configured" },
};

interface Src {
  id: string;
  name: string;
  state: State;
  /** Optional override of the state label. */
  stateLabel?: string;
  lines: string[];
  update: string;
}

export function DataSources({ ds, refreshedAt }: { ds: AnalyticsDataset; refreshedAt: number }) {
  const { checks, onchainActive, chainError, onchain } = useRewards();
  const demoGenerated = `Demo data generated ${labelDateTime(refreshedAt)}`;
  const reg = ds.latest.registration;
  const c = ds.counts;

  let d3: Src;
  if (onchainActive) {
    d3 = {
      id: "D3",
      name: "Smart-contract Ledger · Portal Layer 0",
      state: "connected",
      lines: [`${formatNumber(c.chainEvents)} real contract event${c.chainEvents === 1 ? "" : "s"} for the connected wallet`, "Community-wide events need an indexer — not configured, so the community stays demo."],
      update: onchain ? `Read ${labelDateTime(onchain.at)}` : "Read just now",
    };
  } else if (checks.addressConfigured) {
    d3 = {
      id: "D3",
      name: "Smart-contract Ledger · Portal Layer 0",
      state: "unavailable",
      lines: [chainError ? `Read error: ${chainError}` : !checks.realWallet ? "Contract configured, but no real browser wallet is connected." : !checks.onPortal ? "Wallet is not on Portal V3." : checks.codeFound === false ? "No contract code at the configured address." : "Waiting for a readable balance."],
      update: "No contract read yet",
    };
  } else {
    d3 = {
      id: "D3",
      name: "Smart-contract Ledger · Portal Layer 0",
      state: "demo",
      lines: ["No contract address configured (NEXT_PUBLIC_MEV_CONTRACT_ADDRESS). Reward figures are derived from the demo model."],
      update: demoGenerated,
    };
  }

  const sources: Src[] = [
    {
      id: "D1",
      name: "Users & Vehicles",
      state: reg ? "session" : "demo",
      lines: [`${formatNumber(c.demoCommuters)} synthetic commuter profiles`, reg ? "1 registration from this browser (masked vehicle only)" : "No registration in this browser"],
      update: reg ? `Registered ${labelDateTime(reg)}` : demoGenerated,
    },
    {
      id: "D2",
      name: "Trips & Telemetry",
      state: c.sessionTrips ? "session" : "demo",
      lines: [`${formatNumber(c.demoJourneys)} synthetic journeys`, `${formatNumber(c.sessionTrips)} trip${c.sessionTrips === 1 ? "" : "s"} recorded in this browser`],
      update: ds.latest.trip ? `Latest trip ${labelDateTime(ds.latest.trip)}` : demoGenerated,
    },
    d3,
    {
      id: "D4",
      name: "Redemptions",
      state: c.sessionRedemptions ? "session" : "demo",
      lines: ["Synthetic community redemptions (demo catalog)", `${formatNumber(c.sessionRedemptions)} local record${c.sessionRedemptions === 1 ? "" : "s"} from this browser`],
      update: ds.latest.redemption ? `Latest ${labelDateTime(ds.latest.redemption)}` : demoGenerated,
    },
  ];

  const offline: Array<{ name: string; icon: React.ReactNode; text: string }> = [
    { name: "Azure Cosmos DB", icon: <Database className="size-4" />, text: "No analytics store is configured. Nothing is read from or written to Cosmos DB." },
    { name: "Power BI / enterprise reporting", icon: <FileSpreadsheet className="size-4" />, text: "No workspace connected. Use the CSV / HTML demo export instead." },
  ];

  return (
    <Panel aria-labelledby="sources-title" data-section="sources">
      <PanelHeader id="sources-title" eyebrow="Data flow · Level 1 · process 7.0" title="Data sources and freshness" subtitle="Where every figure on this page comes from, and what is actually connected." />
      <div className="space-y-5 p-4 sm:p-6">
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sources.map((s) => (
            <li key={s.id} data-source={s.id} data-state={s.state} className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-bg-2/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-lime">{s.id}</span>
                <Badge tone={STATE[s.state].tone} dot>
                  {s.stateLabel ?? STATE[s.state].text}
                </Badge>
              </div>
              <p className="text-sm font-medium text-fg">{s.name}</p>
              <ul className="space-y-1 text-xs leading-snug text-muted">
                {s.lines.map((l) => (
                  <li key={l} className="[overflow-wrap:anywhere]">
                    {l}
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-1 font-mono text-[11px] text-muted/90">{s.update}</p>
            </li>
          ))}
        </ul>

        <ol className="grid grid-cols-1 gap-2 md:grid-cols-3" aria-label="Analytics data flow">
          {[
            { n: "7.0 Dashboards & Analytics", sub: "Derived selectors over D1–D4", icon: <Server className="size-4" />, live: true },
            { n: "ESG data", sub: "Aggregate CSV / HTML demo report", icon: <FileSpreadsheet className="size-4" />, live: true },
            { n: "Companies & city planners", sub: "Not connected — no external delivery", icon: <Building2 className="size-4" />, live: false },
          ].map((nd, i, arr) => (
            <li key={nd.n} className={cn("relative flex items-center gap-3 rounded-lg border bg-bg-2/60 p-3", nd.live ? "border-lime/25" : "border-dashed border-line-strong")}>
              <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-md border", nd.live ? "border-lime/40 text-lime" : "border-line-strong text-muted")}>
                {nd.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-tight font-medium text-fg">{nd.n}</p>
                <p className="text-[11px] leading-tight text-muted">{nd.sub}</p>
              </div>
              {i < arr.length - 1 && <ArrowRight aria-hidden className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-panel text-line-strong md:block" />}
            </li>
          ))}
        </ol>

        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Integrations that are not configured">
          {offline.map((o) => (
            <li key={o.name} data-source-off className="flex gap-3 rounded-xl border border-dashed border-line-strong p-4">
              <span aria-hidden className="mt-0.5 text-muted">
                {o.icon}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                  {o.name} <Badge>Not configured</Badge>
                </p>
                <p className="mt-1 text-xs leading-snug text-muted">{o.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
