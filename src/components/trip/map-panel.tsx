"use client";

import { useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, Radio, TrainFront } from "lucide-react";
import { cn } from "@/lib/format";
import { Badge, Panel } from "@/components/ui/primitives";
import { azureConfigured, type MapHandle } from "@/lib/maps/azure";
import { googleConfigured } from "@/lib/maps/google";
import { PROVIDER_NAME } from "@/lib/maps/provider";
import { useTrip } from "@/providers/trip-provider";
import { AzureMapView } from "./map/azure-map";
import { DemoMapView } from "./map/demo-map";
import { GoogleMapView } from "./map/google-map";
import { OsmMapView } from "./map/osm-map";

type LoadState = "loading" | "ready" | "error";

/**
 * Basemap choice, first available wins: Google Maps (key set) → Azure Maps (key set) → the keyless OpenStreetMap
 * basemap. A provider that fails at runtime (bad or restricted key, no network) hands over to the next one.
 * The offline demo map is only the last resort (e.g. no network, so no tiles can load).
 */
export function MapPanel() {
  const { status, setup, route, live, gps, record } = useTrip();
  const handle = useRef<MapHandle>(null);
  const [google, setGoogle] = useState<LoadState>(googleConfigured ? "loading" : "error");
  const [azure, setAzure] = useState<LoadState>(azureConfigured ? "loading" : "error");
  const [osm, setOsm] = useState<LoadState>("loading");
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [azureError, setAzureError] = useState<string | null>(null);
  const [osmError, setOsmError] = useState<string | null>(null);
  /** The commuter's own choice for the metro layer; null = follow the travel mode (on while travelling by metro). */
  const [metroChoice, setMetroChoice] = useState<boolean | null>(null);

  const trail = useMemo(() => live.samples.map((s) => ({ lat: s.lat, lng: s.lng })), [live.samples]);
  const last = live.samples[live.samples.length - 1];
  const position = last ? { lat: last.lat, lng: last.lng } : null;
  const showTrail = status !== "IDLE" || live.samples.length > 1;
  const source = status === "IDLE" ? setup.source : (record?.source ?? setup.source);
  const simRoute = source === "simulated" ? route : null;
  const provider = google !== "error" ? "google" : azure !== "error" ? "azure" : osm !== "error" ? "osm" : "demo";
  const recording = status === "RECORDING";
  // Only the OpenStreetMap and Google basemaps can draw metro lines; Azure and the offline demo map have no such layer.
  const supportsMetro = provider === "osm" || provider === "google";
  const metroOn = supportsMetro && (metroChoice ?? setup.mode === "metro");

  const props = {
    route: simRoute,
    trail: showTrail ? trail : [],
    position: showTrail ? position : null,
    source,
    recording,
    metro: metroOn,
  } as const;

  const btn =
    "grid size-10 place-items-center bg-panel/90 text-fg transition hover:bg-elevated hover:text-cyan focus-visible:relative focus-visible:z-10";

  return (
    <Panel aria-labelledby="map-title" className="overflow-hidden">
      <h2 id="map-title" className="sr-only">
        Trip map
      </h2>
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-auto lg:h-[540px]">
        {provider === "google" ? (
          <GoogleMapView
            key="google"
            ref={handle}
            {...props}
            onReady={() => setGoogle("ready")}
            onError={(m) => {
              console.warn(`[maps] Google Maps unavailable: ${m}`);
              setGoogleError(m);
              setGoogle("error");
            }}
          />
        ) : provider === "azure" ? (
          <AzureMapView
            key="azure"
            ref={handle}
            {...props}
            onReady={() => setAzure("ready")}
            onError={(m) => {
              setAzureError(m);
              setAzure("error");
            }}
          />
        ) : provider === "osm" ? (
          <OsmMapView
            key="osm"
            ref={handle}
            {...props}
            onReady={() => setOsm("ready")}
            onError={(m) => {
              setOsmError(m);
              setOsm("error");
            }}
          />
        ) : (
          <DemoMapView key="demo" ref={handle} {...props} />
        )}

        {/* source / honesty labels */}
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex max-w-[calc(100%-4.5rem)] flex-col items-start gap-1.5">
          {provider === "google" && (
            <Badge tone={google === "ready" ? "ok" : "cyan"} dot>
              {google === "ready" ? "Google Maps basemap" : "Google Maps loading…"}
            </Badge>
          )}
          {provider === "azure" && (
            <Badge tone={azure === "ready" ? "ok" : "cyan"} dot>
              {azure === "ready" ? "Azure Maps basemap" : "Azure Maps loading…"}
            </Badge>
          )}
          {provider === "osm" && (
            <Badge tone={osm === "ready" ? "ok" : "cyan"} dot>
              {osm === "ready" ? "OpenStreetMap basemap" : "Map loading…"}
            </Badge>
          )}
          {provider === "demo" && (
            <Badge tone="warn" dot>
              {source === "simulated" ? "DEMO MAP — SIMULATED ROUTE" : "DEMO MAP — NO BASEMAP · GPS TRAIL ONLY"}
            </Badge>
          )}
          {provider !== "demo" && source === "simulated" && <Badge tone="warn">Simulated route</Badge>}
          {googleError && provider !== "google" && <Badge tone="err">Google Maps error — using {PROVIDER_NAME[provider]}</Badge>}
          {azureError && provider !== "azure" && <Badge tone="err">Azure Maps error — using {PROVIDER_NAME[provider]}</Badge>}
          {osmError && provider === "demo" && <Badge tone="err">Map tiles unavailable — showing demo map</Badge>}
        </div>

        {recording && (
          <div className="pointer-events-none absolute top-3 right-16 z-10 hidden sm:block">
            <Badge tone="err" dot>
              <Radio aria-hidden className="mr-1 inline size-3" />
              Rec · {source === "gps" ? "GPS" : "Simulated"}
            </Badge>
          </div>
        )}

        {/* zoom / recenter */}
        <div role="group" aria-label="Map controls" className="absolute top-3 right-3 z-10 flex flex-col overflow-hidden rounded-lg border border-line-strong shadow-lg shadow-shade/15">
          <button type="button" className={`${btn} border-b border-line`} aria-label="Zoom in" onClick={() => handle.current?.zoomIn()}>
            <Plus aria-hidden className="size-4" />
          </button>
          <button type="button" className={`${btn} border-b border-line`} aria-label="Zoom out" onClick={() => handle.current?.zoomOut()}>
            <Minus aria-hidden className="size-4" />
          </button>
          <button type="button" className={cn(btn, supportsMetro && "border-b border-line")} aria-label="Recenter map" onClick={() => handle.current?.recenter()}>
            <LocateFixed aria-hidden className="size-4" />
          </button>
          {supportsMetro && (
            <button
              type="button"
              className={cn(btn, metroOn && "bg-lime/[0.12] text-lime")}
              aria-label="Show metro and rail lines"
              aria-pressed={metroOn}
              title="Metro and rail lines and stations (metro = the thinner lines)"
              onClick={() => setMetroChoice(!metroOn)}
            >
              <TrainFront aria-hidden className="size-4" />
            </button>
          )}
        </div>

        {/* readout chips */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
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
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6 text-center">
            <p className="max-w-xs rounded-xl border border-line bg-panel/80 px-4 py-3 text-sm text-muted backdrop-blur">
              Press <span className="font-mono text-fg">START TRIP</span> to capture your real GPS trail. The browser will ask for location permission first.
            </p>
          </div>
        )}
        {gps.signal === "simulated" && recording && (
          <p className="pointer-events-none absolute right-3 bottom-8 z-10 rounded-md border border-warn/40 bg-panel/90 px-2 py-1 font-mono text-[11px] tracking-[0.12em] text-warn">
            SIMULATED POSITION — NOT GPS
          </p>
        )}
      </div>
    </Panel>
  );
}
