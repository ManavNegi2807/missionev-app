"use client";

import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { MapHandle } from "@/lib/maps/azure";
import { createOsmMap, type OsmMapController } from "@/lib/maps/osm";
import type { MapViewProps } from "./types";

/** Keyless OpenStreetMap basemap (Leaflet). Mounted when no Azure Maps key is configured; reports readiness/errors upward. */
export const OsmMapView = forwardRef<MapHandle, MapViewProps & { onReady(): void; onError(msg: string): void }>(function OsmMapView(
  { route, trail, position, metro, onReady, onError },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const ctl = useRef<OsmMapController | null>(null);
  const latest = useRef({ route, trail, position, metro });

  useEffect(() => {
    latest.current = { route, trail, position, metro };
  }, [route, trail, position, metro]);

  useEffect(() => {
    ctl.current?.setMetro(metro);
  }, [metro]);

  // The planned route is only pushed when it changes, so panning isn't fought by a re-fit on every GPS sample.
  useEffect(() => {
    ctl.current?.setRoute(route ? route.points : null);
  }, [route]);

  useEffect(() => {
    ctl.current?.setTrail(trail);
    ctl.current?.setVehicle(position);
  }, [trail, position]);

  useEffect(() => {
    let cancelled = false;
    // Each mount gets its own host node: Leaflet refuses to initialise a node a previous (not yet removed) map still
    // owns, which is exactly what StrictMode's mount → unmount → mount sequence would otherwise hit.
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;inset:0";
    el.current!.appendChild(host);
    createOsmMap(host, {
      route: latest.current.route?.points ?? null,
      // A map from an unmounted effect (React StrictMode mounts twice in dev) must not report into the live one.
      onReady: () => !cancelled && onReady(),
      onError: (m) => !cancelled && onError(m),
    })
      .then((c) => {
        if (cancelled) {
          c.destroy();
          return;
        }
        ctl.current = c;
        c.setMetro(latest.current.metro);
        c.setTrail(latest.current.trail);
        c.setVehicle(latest.current.position);
      })
      .catch((e: unknown) => onError(e instanceof Error ? e.message : "The map failed to load."));
    return () => {
      cancelled = true;
      ctl.current?.destroy();
      ctl.current = null;
      host.remove();
    };
    // The map is created once per mount; props are streamed in through `latest` and the effects above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => ctl.current?.zoomIn(),
    zoomOut: () => ctl.current?.zoomOut(),
    recenter: () => ctl.current?.recenter(),
    setMetro: (on) => ctl.current?.setMetro(on),
  }));

  return <div ref={el} className="absolute inset-0 z-0 bg-[var(--map-bg)]" aria-label="OpenStreetMap basemap" />;
});
