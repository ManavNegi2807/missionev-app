import { Database, EyeOff, Server, Wallet } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/primitives";

function Item({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-line bg-bg-2/60 p-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border border-line-strong text-cyan">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs leading-snug text-muted">{note}</p>
      </div>
    </li>
  );
}

/** What this app keeps, and where, in plain words. */
export function DataPanel() {
  return (
    <Panel aria-labelledby="data-title">
      <PanelHeader id="data-title" eyebrow="Your data" title="What MissionEV keeps, and where" />
      <div className="p-4 sm:p-6">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Item icon={<Wallet className="size-4" />} title="Your account" note="Your public wallet address. No phone number, name or e-mail is collected." />
          <Item icon={<Database className="size-4" />} title="In this tab only" note="Your transport profile and trips live in this browser tab and disappear when you close it." />
          <Item icon={<EyeOff className="size-4" />} title="Rounded locations" note="Trip coordinates are rounded to about 110 m, and receipt images never leave your device." />
          <Item icon={<Server className="size-4" />} title="The server" note="Sees a trip only when you ask it to sign a reward, and stores nothing about you." />
        </ul>
      </div>
    </Panel>
  );
}
