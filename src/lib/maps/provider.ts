import { azureConfigured } from "./azure";
import { googleConfigured } from "./google";

export type MapProvider = "google" | "azure" | "osm" | "demo";

export const PROVIDER_NAME: Record<MapProvider, string> = {
  google: "Google Maps",
  azure: "Azure Maps",
  osm: "OpenStreetMap",
  demo: "demo map",
};

/** The basemap the build is configured for (first key found, else the keyless default); runtime failures may fall back further. */
export const CONFIGURED_BASEMAP: string = googleConfigured ? PROVIDER_NAME.google : azureConfigured ? PROVIDER_NAME.azure : PROVIDER_NAME.osm;
