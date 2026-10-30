"use client";

import { useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, Radio } from "lucide-react";
import { Badge, Panel } from "@/components/ui/primitives";
import { azureConfigured, type MapHandle } from "@/lib/maps/azure";
import { useTrip } from "@/providers/trip-provider";
import { AzureMapView } from "./map/azure-map";
import { DemoMapView } from "./map/demo-map";

export function MapPanel() {
  const { status, setup, route, live, gps, record } = useTrip();
  const handle = useRef<MapHandle>(null);
  const [azure, setAzure] = useState<"loading" | "ready" | "error">(azureConfigured ? "loading" : "error");
  const [azureError, setAzureError] = useState<string | null>(null);

  const trail = useMemo(() => live.samples.map((s) => ({ lat: s.lat, lng: s.lng })), [live.samples]);
  const last = live.samples[live.samples.length - 1];
  const position = last ? { lat: last.lat, lng: last.lng } : null;
  const showTrail = status !== "IDLE" || live.samples.length > 1;
  const source = status === "IDLE" ? setup.source : (record?.source ?? setup.source);
  const simRoute = source === "simulated" ? route : null;
  const useAzure = azureConfigured && azure !== "error";
  const recording = status === "RECORDING";

  const props = {
    route: simRoute,
    trail: showTrail ? trail : [],
    position: showTrail ? position : null,
    source,
    recording,
  } as const;

  const btn =
    "grid size-10 place-items-center bg-panel/90 text-fg transition hover:bg-elevated hover:text-cyan focus-visible:relative focus-visible:z-10";

  return (
    <Panel aria-labelledby="map-title" className="overflow-hidden">
      <h2 id="map-title" className="sr-only">
        Trip map
      </h2>
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-auto lg:h-[540px]">
        {useAzure ? (
          <AzureMapView
            ref={handle}
            {...props}
            onReady={() => setAzure("ready")}
            onError={(m) => {
              setAzureError(m);
              setAzure("error");
            }}
          />
        ) : (
          <DemoMapView ref={handle} {...props} />
        )}

        {/* source / honesty labels */}
        <div className="pointer-events-none absolute top-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-col items-start gap-1.5">
          {useAzure ? (
            <Badge tone={azure === "ready" ? "ok" : "cyan"} dot>
              {azure === "ready" ? "Azure Maps basemap" : "Azure Maps loading…"}
            </Badge>
          ) : (
            <Badge tone="warn" dot>
              {source === "simulated" ? "DEMO MAP — SIMULATED ROUTE" : "DEMO MAP — NO BASEMAP · GPS TRAIL ONLY"}
            </Badge>
          )}
          {useAzure && source === "simulated" && <Badge tone="warn">Simulated route</Badge>}
          {!azureConfigured && <Badge>Azure Maps not configured</Badge>}
          {azureError && <Badge tone="err">Azure Maps error — showing demo map</Badge>}
        </div>

        {recording && (
          <div className="pointer-events-none absolute top-3 right-16 hidden sm:block">
            <Badge tone="err" dot>
              <Radio aria-hidden className="mr-1 inline size-3" />
              Rec · {source === "gps" ? "GPS" : "Simulated"}
            </Badge>
          </div>
        )}

        {/* zoom / recenter */}
        <div role="group" aria-label="Map controls" className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-lg border border-line-strong shadow-lg shadow-shade/15">
          <button type="button" className={`${btn} border-b border-line`} aria-label="Zoom in" onClick={() => handle.current?.zoomIn()}>
            <Plus aria-hidden className="size-4" />
          </button>
          <button type="button" className={`${btn} border-b border-line`} aria-label="Zoom out" onClick={() => handle.current?.zoomOut()}>
            <Minus aria-hidden className="size-4" />
          </button>
          <button type="button" className={btn} aria-label="Recenter map" onClick={() => handle.current?.recenter()}>
            <LocateFixed aria-hidden className="size-4" />
          </button>
        </div>

        {/* readout chips */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2">
          {source === "simulated" && (
            <span className="rounded-md border border-line-strong bg-panel/90 px-2 py-1 font-mono text-[11px] text-fg">
              ROUTE <span className="text-cyan">{route.lengthKm.toFixed(1)} km</span>
            </span>
          )}
          {showTrail && (
            <span className="rounded-md border border-line-strong bg-panel/90 px-2 py-1 font-mono text-[11px] text-fg">
              TRAVELLED <span className="text-lime">{live.distanceKm.toFixed(2)} km</span>
            </span>
          )}
        </div>

        {status === "IDLE" && live.samples.length === 0 && source === "gps" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center">
            <p className="max-w-xs rounded-xl border border-line bg-panel/80 px-4 py-3 text-sm text-muted backdrop-blur">
              Press <span className="font-mono text-fg">START TRIP</span> to capture your real GPS trail. The browser will ask for location permission first.
            </p>
          </div>
        )}
        {gps.signal === "simulated" && recording && (
          <p className="pointer-events-none absolute right-3 bottom-3 rounded-md border border-warn/40 bg-panel/90 px-2 py-1 font-mono text-[11px] tracking-[0.12em] text-warn">
            SIMULATED POSITION — NOT GPS
          </p>
        )}
      </div>
    </Panel>
  );
}
