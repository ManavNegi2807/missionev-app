"use client";

import type { ReactNode } from "react";
import { Award, Leaf, Route, Ticket, Timer } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { formatNumber } from "@/lib/format";
import { useRewards } from "@/providers/rewards-provider";

function Stat({ label, value, unit, icon, tone, source, sub }: { label: string; value: ReactNode; unit?: string; icon: ReactNode; tone: "lime" | "cyan"; source: "demo" | "onchain" | "session"; sub: string }) {
  return (
    <div data-stat={label} className="min-w-0 rounded-xl border border-line bg-panel p-4 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden className={tone === "lime" ? "text-lime" : "text-cyan"}>
          {icon}
        </span>
        <Badge tone={source === "onchain" ? "ok" : source === "demo" ? "warn" : "neutral"}>{source === "onchain" ? "On-chain" : source === "demo" ? "Demo" : "Session"}</Badge>
      </div>
      <p className="section-label mt-3">{label}</p>
      <p className="mt-1.5 font-mono text-2xl leading-none font-semibold text-fg">
        {value}
        {unit && <span className="ml-1.5 text-[11px] font-normal text-muted">{unit}</span>}
      </p>
      <p className="mt-2 text-xs leading-snug text-muted">{sub}</p>
    </div>
  );
}

export function RewardStats() {
  const { summary: s, onchainActive } = useRewards();
  const chainOrDemo = onchainActive ? "onchain" : "demo";
  const avoidedKg = s.avoidedG / 1000;
  return (
    <section aria-label="Reward summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      <Stat label="Mobility rewards earned" value={formatNumber(s.earned)} unit="$MEV" icon={<Award className="size-5" />} tone="lime" source={chainOrDemo} sub={onchainActive ? "from contract events" : "demo credits, not minted"} />
      <Stat label="Verified journeys" value={formatNumber(s.cleanJourneys)} icon={<Route className="size-5" />} tone="cyan" source="demo" sub="verified trips this session (mock checks)" />
      <Stat label="Reward points pending" value={formatNumber(s.pending)} unit="$MEV" icon={<Timer className="size-5" />} tone="lime" source="demo" sub="verified but not recorded yet" />
      <Stat label="Successful redemptions" value={formatNumber(s.successfulRedemptions)} icon={<Ticket className="size-5" />} tone="cyan" source={onchainActive ? "onchain" : "demo"} sub={onchainActive ? "completed + simulated records" : "simulated redemptions"} />
      <Stat
        label="Est. emissions avoided"
        value={avoidedKg < 10 ? formatNumber(avoidedKg, 3) : formatNumber(avoidedKg, 1)}
        unit="kg CO₂e"
        icon={<Leaf className="size-5" />}
        tone="lime"
        source={chainOrDemo}
        sub={onchainActive ? "from contract events" : `illustrative · ${s.cleanJourneys} verified journey${s.cleanJourneys === 1 ? "" : "s"}`}
      />
    </section>
  );
}
