"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createAzureMap, type AzureMapController, type MapHandle } from "@/lib/maps/azure";
import type { MapViewProps } from "./types";

/** Real Azure Maps basemap. Mounted only when a browser key is configured; reports readiness/errors upward. */
export const AzureMapView = forwardRef<MapHandle, MapViewProps & { onReady(): void; onError(msg: string): void }>(function AzureMapView(
  { route, trail, position, onReady, onError },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const ctl = useRef<AzureMapController | null>(null);
  const latest = useRef({ route, trail, position });

  useEffect(() => {
    latest.current = { route, trail, position };
    ctl.current?.setRoute(route ? route.points : null);
  }, [route, trail, position]);

  useEffect(() => {
    ctl.current?.setTrail(trail);
    ctl.current?.setVehicle(position);
  }, [trail, position]);

  useEffect(() => {
    let cancelled = false;
    createAzureMap(el.current!, {
      route: latest.current.route?.points ?? null,
      onReady: () => {
        ctl.current?.setTrail(latest.current.trail);
        ctl.current?.setVehicle(latest.current.position);
        onReady();
      },
      onError,
    })
      .then((c) => {
        if (cancelled) c.destroy();
        else ctl.current = c;
      })
      .catch((e: unknown) => onError(e instanceof Error ? e.message : "Azure Maps failed to load."));
    return () => {
      cancelled = true;
      ctl.current?.destroy();
      ctl.current = null;
    };
    // The map is created once per mount; props are streamed in through `latest` and the effects above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => ctl.current?.zoomIn(),
    zoomOut: () => ctl.current?.zoomOut(),
    recenter: () => ctl.current?.recenter(),
  }));

  return <div ref={el} className="absolute inset-0" aria-label="Azure Maps basemap" />;
});
