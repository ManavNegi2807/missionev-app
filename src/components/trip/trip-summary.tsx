"use client";

import { Lock, Snowflake } from "lucide-react";
import { Badge, KV, Panel, PanelHeader } from "@/components/ui/primitives";
import { formatClock, formatDuration } from "@/lib/format";
import { useTrip } from "@/providers/trip-provider";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(10, ...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 200).toFixed(1)},${(46 - (v / max) * 42).toFixed(1)}`).join(" ");
  return (
    <figure className="min-w-0">
      <svg viewBox="0 0 200 48" preserveAspectRatio="none" role="img" aria-label={`Speed profile, peak ${max.toFixed(0)} kilometres per hour`} className="h-14 w-full overflow-hidden">
        <polyline points={`0,46 ${pts} 200,46`} fill="var(--color-cyan)" fillOpacity={0.1} stroke="none" />
        <polyline points={pts} fill="none" stroke="var(--color-cyan)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[11px] tracking-wider text-muted">
        <span>SPEED PROFILE</span>
        <span>PEAK {max.toFixed(0)} km/h</span>
      </figcaption>
    </figure>
  );
}

export function TripSummary() {
  const { record, status } = useTrip();

  return (
    <Panel aria-labelledby="summary-title2">
      <PanelHeader
        id="summary-title2"
        eyebrow="Process 2.0 → D2"
        title="Trip summary"
        action={
          record ? (
            <Badge tone="cyan">
              <Snowflake aria-hidden className="mr-1 inline size-3" />
              Frozen
            </Badge>
          ) : undefined
        }
      />
      <div className="p-4 sm:p-6">
        {!record ? (
          <div className="flex items-start gap-3 text-sm text-muted">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{status === "IDLE" ? "Capture a trip, then press STOP TRIP. The metrics are frozen into a summary and the verification action unlocks." : "Recording… the summary is created when you stop the trip."}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <KV label="Trip ID" mono>
                {record.id}
              </KV>
              <KV label="Source">{record.isSimulated ? "Simulated (DEMO)" : "Browser GPS"}</KV>
              <KV label="Distance" mono>
                {record.distanceKm.toFixed(2)} km
              </KV>
              <KV label="Duration" mono>
                {formatDuration(record.durationSec)}
              </KV>
              <KV label="Average speed" mono>
                {record.avgSpeedKmh.toFixed(1)} km/h
              </KV>
              <KV label="Max speed" mono>
                {record.maxSpeedKmh.toFixed(1)} km/h
              </KV>
              <KV label="Samples" mono>
                {record.sampleCount}
              </KV>
              <KV label="Ended">{formatClock(record.endedAt)}</KV>
            </dl>
            <Sparkline values={record.speedProfile} />
            <p className="text-xs leading-relaxed text-muted">
              {record.isSimulated
                ? "Simulated trip: durations use a ×40 simulated clock; none of these readings came from a GPS receiver."
                : "Only coordinates rounded to ~110 m and a speed profile are kept in session history; the raw trail stays in this tab."}
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
