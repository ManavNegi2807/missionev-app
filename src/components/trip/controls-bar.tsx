"use client";

import type { ReactNode } from "react";
import { Pause, Play, RotateCcw, ShieldCheck, Square, Plus } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useTrip } from "@/providers/trip-provider";

function Ctl({
  full,
  short,
  icon,
  ...rest
}: { full: string; short: string; icon: ReactNode } & Omit<React.ComponentProps<typeof Button>, "children" | "icon" | "size">) {
  return (
    <Button size="lg" icon={icon} aria-label={full} {...rest} className={`h-12 min-w-0 px-2 text-[11px] sm:px-4 sm:text-xs ${rest.className ?? ""}`}>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{full}</span>
    </Button>
  );
}

/**
 * Journey controls. Below `lg` the bar is pinned to the bottom of the viewport so Start/Stop
 * stay reachable while scrolling the telemetry; on desktop it sits under the map.
 */
export function ControlsBar() {
  const { status, gps, start, pause, resume, stop, verifyTrip, reset } = useTrip();
  const active = status === "RECORDING" || status === "PAUSED";

  let primary: ReactNode;
  if (status === "IDLE") {
    primary = (
      <Ctl full="START TRIP" short="START" variant="primary" icon={<Play aria-hidden className="size-4" />} loading={gps.signal === "requesting"} onClick={() => void start()} />
    );
  } else if (status === "COMPLETED") {
    primary = <Ctl full="VERIFY TRIP" short="VERIFY" variant="primary" icon={<ShieldCheck aria-hidden className="size-4" />} onClick={() => void verifyTrip()} />;
  } else if (status === "VERIFYING") {
    primary = <Ctl full="VERIFYING…" short="VERIFYING" variant="primary" loading icon={null} disabled />;
  } else if (status === "VERIFIED" || status === "FAILED") {
    primary = <Ctl full="NEW TRIP" short="NEW" variant="primary" icon={<Plus aria-hidden className="size-4" />} onClick={reset} />;
  } else {
    primary = <Ctl full="START TRIP" short="START" variant="primary" icon={<Play aria-hidden className="size-4" />} disabled />;
  }

  return (
    <>
      <div className="h-24 lg:hidden" aria-hidden />
      <div
        role="group"
        aria-label="Trip controls"
        className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t border-line-strong px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:rounded-2xl lg:border lg:p-3"
      >
        <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-2">
          {primary}
          {status === "PAUSED" ? (
            <Ctl full="RESUME TRIP" short="RESUME" icon={<Play aria-hidden className="size-4" />} onClick={resume} />
          ) : (
            <Ctl full="PAUSE TRIP" short="PAUSE" icon={<Pause aria-hidden className="size-4" />} disabled={status !== "RECORDING"} onClick={pause} />
          )}
          <Ctl full="STOP TRIP" short="STOP" variant="danger" icon={<Square aria-hidden className="size-4" />} disabled={!active} onClick={stop} />
          <Ctl full="RESET DEMO" short="RESET" icon={<RotateCcw aria-hidden className="size-4" />} onClick={reset} />
        </div>
      </div>
    </>
  );
}
