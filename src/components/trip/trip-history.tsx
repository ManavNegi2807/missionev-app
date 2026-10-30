"use client";

import { Trash2 } from "lucide-react";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatDuration } from "@/lib/format";
import { useTrip } from "@/providers/trip-provider";

export function TripHistory() {
  const { history, clearHistory } = useTrip();

  return (
    <Panel aria-labelledby="history-title">
      <PanelHeader
        id="history-title"
        eyebrow="D2 · this browser tab"
        title="Trip history"
        subtitle="Shared with the Rewards and Analytics screens. Stored in session storage with coordinates rounded to ~110 m."
        action={
          history.length > 0 ? (
            <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden className="size-3.5" />} onClick={clearHistory}>
              Clear
            </Button>
          ) : undefined
        }
      />
      {history.length === 0 ? (
        <p className="p-4 text-sm text-muted sm:p-6">No verified or failed trips yet in this session.</p>
      ) : (
        <ul className="divide-y divide-line">
          {history.map((t) => (
            <li key={t.id} className="grid grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:px-6">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-fg">{t.id}</p>
                <p className="truncate text-[11px] text-muted">{t.routeName ?? "Browser GPS"}</p>
              </div>
              <p className="text-right font-mono text-xs sm:text-left">
                {t.distanceKm.toFixed(2)} km <span className="block text-[11px] text-muted">{formatDuration(t.durationSec)}</span>
              </p>
              <p className="font-mono text-xs">
                {t.emissions ? `${t.emissions.estimatedG.toFixed(1)} g` : "—"}
                <span className="block text-[11px] text-muted">{t.emissions ? `${t.emissions.tokens} $MEV` : "no reward"}</span>
              </p>
              <p className="text-right font-mono text-xs sm:text-left">{t.verification?.trust.assigned ? `Trust 4.0 · ${t.verification.trust.tier}` : "Not verified"}</p>
              <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:justify-end">
                <Badge tone={t.status === "VERIFIED" ? "ok" : "err"}>{t.status}</Badge>
                {t.isSimulated && <Badge tone="warn">Demo</Badge>}
                {t.ledger.phase === "previewed" && <Badge tone="neutral">Preview</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
