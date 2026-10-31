import type { DemoRoute } from "@/lib/trip/demo-routes";
import type { LatLng } from "@/lib/trip/geo";
import type { TripSource } from "@/lib/trip/types";

export interface MapViewProps {
  /** Planned illustrative route (simulated trips only). */
  route: DemoRoute | null;
  /** Positions captured so far (real GPS or simulated, per `source`). */
  trail: LatLng[];
  position: LatLng | null;
  source: TripSource;
  recording: boolean;
  /** Draw metro lines and stations (basemaps that can't simply ignore it). */
  metro: boolean;
}
