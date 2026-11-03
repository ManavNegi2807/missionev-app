import { googleConfigured } from "./google";

export type MapProvider = "google" | "osm" | "demo";

export const PROVIDER_NAME: Record<MapProvider, string> = {
  google: "Google Maps",
  osm: "OpenStreetMap",
  demo: "demo map",
};

/** The basemap the build is configured for (Leaflet + OpenStreetMap unless a Google key is set); runtime failures may fall back further. */
export const CONFIGURED_BASEMAP: string = googleConfigured ? PROVIDER_NAME.google : PROVIDER_NAME.osm;
