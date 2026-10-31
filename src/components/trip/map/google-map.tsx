"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { MapHandle } from "@/lib/maps/azure";
import { createGoogleMap, type GoogleMapController } from "@/lib/maps/google";
import type { MapViewProps } from "./types";

/** Google Maps basemap. Mounted only when a browser key is configured; reports readiness/errors upward. */
export const GoogleMapView = forwardRef<MapHandle, MapViewProps & { onReady(): void; onError(msg: string): void }>(function GoogleMapView(
  { route, trail, position, metro, onReady, onError },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const ctl = useRef<GoogleMapController | null>(null);
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
    // One host node per mount, so StrictMode's mount → unmount → mount never shares a node between two maps.
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;inset:0";
    el.current!.appendChild(host);
    createGoogleMap(host, {
      route: latest.current.route?.points ?? null,
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
      .catch((e: unknown) => !cancelled && onError(e instanceof Error ? e.message : "Google Maps failed to load."));
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

  return <div ref={el} className="absolute inset-0 z-0 bg-[var(--map-bg)]" aria-label="Google Maps basemap" />;
});
