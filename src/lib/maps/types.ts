/** What every basemap (Leaflet/OpenStreetMap, Google Maps, the offline demo map) lets the map panel do. */
export interface MapHandle {
  zoomIn(): void;
  zoomOut(): void;
  recenter(): void;
  /** Show / hide metro lines and stations. Only basemaps that can draw them implement this. */
  setMetro?(on: boolean): void;
}
