"use client";

import { ArrowRight, Database, Map, Server, UserRound } from "lucide-react";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { azureConfigured } from "@/lib/maps/azure";
import { useTrip } from "@/providers/trip-provider";

/** Level 1 / Level 2 flow for processes 2.0 → 5.0, with the services that feed each verification check. */
export function TripDataFlow() {
  const { status, record } = useTrip();

  const activeIdx =
    status === "VERIFYING"
      ? 3
      : status === "COMPLETED"
        ? 2
        : status === "VERIFIED"
          ? record?.ledger.phase === "previewed"
            ? 5
            : 4
          : status === "RECORDING" || status === "PAUSED"
            ? 1
            : status === "FAILED"
              ? 3
              : -1;

  const nodes = [
    { n: "Commuter", sub: "external entity", icon: <UserRound className="size-4" />, kind: "entity" },
    { n: "2.0 Capture Trip", sub: "GPS / simulated", icon: <Server className="size-4" />, kind: "process" },
    { n: "D2 Trips & Telemetry", sub: "frontend state (session)", icon: <Database className="size-4" />, kind: "store" },
    { n: "3.0 Verify Trip", sub: "checks 3.1–3.4 → 3.5", icon: <Server className="size-4" />, kind: "process" },
    { n: "4.0 Calculate CO₂ & Tokens", sub: "contract maths", icon: <Server className="size-4" />, kind: "process" },
    { n: "5.0 Record On-chain", sub: "preview only", icon: <Server className="size-4" />, kind: "process" },
    { n: "D3 Smart-contract Ledger", sub: "not connected", icon: <Database className="size-4" />, kind: "store" },
  ];

  const feeders = [
    { from: "Vahan registry", to: "3.1", status: "Demo registry", tone: "warn" as const },
    { from: "EV maker API", to: "3.2", status: "Not connected", tone: "neutral" as const },
    { from: "D2 Trips & Telemetry", to: "3.3", status: "Local rules", tone: "cyan" as const },
    { from: "Azure Maps", to: "3.4 / map", status: azureConfigured ? "Basemap key set" : "Not configured", tone: azureConfigured ? ("cyan" as const) : ("neutral" as const) },
  ];

  return (
    <Panel aria-labelledby="flow2-title">
      <PanelHeader id="flow2-title" eyebrow="Data flow · Level 1 & 2" title="Capture → verify → calculate → record" />
      <div className="space-y-5 p-4 sm:p-6">
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {nodes.map((nd, i) => (
            <li
              key={nd.n}
              className={cn(
                "relative flex items-center gap-3 rounded-lg border bg-bg-2/60 p-3",
                nd.kind === "store" ? "border-lime/25" : "border-line",
                i === activeIdx && "border-cyan/60 shadow-glow-cyan",
              )}
              aria-current={i === activeIdx ? "step" : undefined}
            >
              <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-md border", nd.kind === "store" ? "border-lime/40 text-lime" : "border-line-strong text-cyan")}>
                {nd.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-tight font-medium text-fg">{nd.n}</p>
                <p className="text-[11px] leading-tight text-muted">{nd.sub}</p>
              </div>
              {i < nodes.length - 1 && <ArrowRight aria-hidden className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-panel text-line-strong xl:block" />}
            </li>
          ))}
        </ol>

        <div>
          <p className="section-label mb-2">Feeds into verification</p>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {feeders.map((f) => (
              <li key={f.from} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-fg">
                  <Map aria-hidden className="size-3.5 shrink-0 text-muted" />
                  <span>{f.from}</span>
                  <ArrowRight aria-hidden className="size-3 shrink-0 text-muted" />
                  <span className="font-mono whitespace-nowrap text-lime">{f.to}</span>
                </span>
                <Badge tone={f.tone} className="shrink-0">
                  {f.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
