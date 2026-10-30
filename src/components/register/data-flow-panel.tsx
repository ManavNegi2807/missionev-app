import { ArrowDown, Database, Link2, Smartphone, UserRound, Wallet } from "lucide-react";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";

/** Compact view of process 1.0 from the Build with Bharat data-flow diagram. */
function Node({ icon, title, note, badge }: { icon: React.ReactNode; title: string; note: string; badge?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-bg-2/60 p-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border border-line-strong text-cyan">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{title}</p>
        <p className="truncate text-xs text-muted">{note}</p>
      </div>
      {badge}
    </li>
  );
}

export function DataFlowPanel() {
  return (
    <Panel aria-labelledby="flow-title">
      <PanelHeader id="flow-title" eyebrow="Data flow" title="1.0 Sign-in & Register" />
      <div className="p-4 sm:p-6">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Node icon={<UserRound className="size-4" />} title="Commuter" note="External entity · enters wallet + vehicle" />
          <Node icon={<Wallet className="size-4" />} title="Portal wallet" note="External entity · identity & network" />
          <Node
            icon={<Link2 className="size-4" />}
            title="Vahan / vehicle registry"
            note="External entity · RC lookup"
            badge={<Badge tone="warn">Demo</Badge>}
          />
          <Node
            icon={<Smartphone className="size-4" />}
            title="EV maker API"
            note="Optional · not integrated yet"
            badge={<Badge>Off</Badge>}
          />
        </ul>
        <div aria-hidden className="my-2 flex justify-center text-line-strong">
          <ArrowDown className="size-4" />
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-lime/30 bg-lime/[0.05] p-3">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border border-lime/40 text-lime">
            <Database className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wider text-lime">D1 — USERS &amp; VEHICLES</p>
            <p className="text-xs text-muted">Frontend state · masked registration only</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
