import type { LatLng } from "@/lib/trip/geo";
import type { MapHandle } from "./azure";

/**
 * Keyless basemap: Leaflet + the OpenStreetMap standard tile server. It works with no API key, so it is the
 * default whenever Azure Maps isn't configured. The dark theme recolours the same tiles with a CSS filter
 * (OSM publishes no dark tile set). Attribution is required by the OSM licence and is always shown.
 *
 * openstreetmap.org's tile servers are for light, interactive use (see their tile usage policy), which fits a
 * prototype. For production traffic set NEXT_PUBLIC_AZURE_MAPS_KEY (preferred, see azure.ts) or point TILE_URL
 * at a commercial / self-hosted tile provider. Note that "free keyless" third-party tile hosts change their
 * terms: CARTO's basemaps, for one, now return an "API key required" watermark instead of map tiles.
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_FILTER = "invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.88)";

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/**
 * Metro overlay: OpenRailwayMap draws railway lines and stations from OpenStreetMap data as transparent tiles on top
 * of the basemap. Keyless, but a volunteer-run service for light use, like the OSM tile servers. It draws ALL
 * railways: metro / subway lines are the thin light ones with italic station names, mainline rail is the bold dark
 * blue. It has no metro-only style, so a metro-only layer would need our own line/station dataset. (The Overpass API
 * could supply one, but its public instances reject browser requests.)
 */
const METRO_URL = "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png";
const METRO_ATTRIBUTION = 'Metro: <a href="https://www.openrailwaymap.org/" target="_blank" rel="noopener noreferrer">OpenRailwayMap</a> (CC-BY-SA)';

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];
const FOLLOW_ZOOM = 16;
/** Failed tiles (with none loaded yet) before we give up on this provider and let the caller fall back. */
const TILE_ERROR_LIMIT = 8;

export interface OsmMapController extends MapHandle {
  setMetro(on: boolean): void;
  setRoute(points: LatLng[] | null): void;
  setTrail(points: LatLng[]): void;
  setVehicle(p: LatLng | null): void;
  destroy(): void;
}

export async function createOsmMap(
  el: HTMLElement,
  opts: { route: LatLng[] | null; onReady(): void; onError(message: string): void },
): Promise<OsmMapController> {
  const mod = (await import("leaflet")) as unknown as { default?: typeof import("leaflet") } & typeof import("leaflet");
  const L = mod.default ?? mod;

  const root = document.documentElement;
  const isDark = () => root.dataset.theme === "dark";
  const css = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
  const palette = () => ({ start: css("--color-cyan"), end: css("--color-fg"), vehicle: css("--color-lime"), ring: css("--color-panel") });

  const map = L.map(el, { zoomControl: false, attributionControl: false, minZoom: 3, maxZoom: 19, zoomSnap: 0.5 });
  L.control.attribution({ prefix: false, position: "bottomright" }).addTo(map);
  map.setView(DEFAULT_CENTER, 11);

  const tiles = L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
  const metroTiles = L.tileLayer(METRO_URL, { attribution: METRO_ATTRIBUTION, subdomains: "abc", maxZoom: 19, opacity: 0.9 });
  const tint = () => {
    // The overlay gets the same recolouring as the basemap so its dark lines stay readable on the dark map.
    for (const layer of [tiles, metroTiles]) {
      const pane = layer.getContainer();
      if (pane) pane.style.filter = isDark() ? DARK_FILTER : "";
    }
  };
  tint();

  let loaded = 0;
  let failed = 0;
  let ready = false;
  // Tearing a map down aborts its in-flight tiles, which Leaflet reports as tile errors. Those must not count.
  let destroyed = false;
  tiles.on("tileload", () => {
    if (destroyed) return;
    loaded++;
    if (!ready) {
      ready = true;
      opts.onReady();
    }
  });
  tiles.on("tileerror", () => {
    if (destroyed) return;
    failed++;
    if (!ready && loaded === 0 && failed >= TILE_ERROR_LIMIT) opts.onError("Map tiles could not be loaded. Check your connection.");
  });

  const pal = palette();
  const dot = (color: string, radius: number) => ({ radius, color: pal.ring, weight: 2, fillColor: color, fillOpacity: 1 });
  const routeLine = L.polyline([], { color: pal.start, weight: 3, opacity: 0.65, dashArray: "2 7" }).addTo(map);
  const trailLine = L.polyline([], { color: pal.vehicle, weight: 5, opacity: 0.95, lineJoin: "round", lineCap: "round" }).addTo(map);
  const startMarker = L.circleMarker(DEFAULT_CENTER, dot(pal.start, 7));
  const endMarker = L.circleMarker(DEFAULT_CENTER, dot(pal.end, 7));
  const vehicleMarker = L.circleMarker(DEFAULT_CENTER, dot(pal.vehicle, 9));

  let vehicle: LatLng | null = null;
  let routePts: LatLng[] | null = null;
  /** Follow the vehicle until the user pans away; "recenter" turns it back on. */
  let follow = true;
  let sized = false;

  const ll = (p: LatLng): [number, number] => [p.lat, p.lng];
  const fit = (pts: LatLng[]) => {
    if (pts.length) map.fitBounds(L.latLngBounds(pts.map(ll)), { padding: [70, 70], animate: true, duration: 0.4 });
  };

  const setRoute = (points: LatLng[] | null) => {
    routePts = points && points.length > 1 ? points : null;
    routeLine.setLatLngs(routePts ? routePts.map(ll) : []);
    if (routePts) {
      startMarker.setLatLng(ll(routePts[0])).addTo(map);
      endMarker.setLatLng(ll(routePts[routePts.length - 1])).addTo(map);
      fit(routePts);
    } else {
      startMarker.remove();
      endMarker.remove();
    }
  };
  setRoute(opts.route);

  map.on("dragstart", () => {
    follow = false;
  });
  // Leaflet sizes itself once on creation; the panel resizes (breakpoints, sidebar collapse), so keep it in sync.
  const resizer = new ResizeObserver(() => {
    if (!sized) {
      sized = true;
      return;
    }
    map.invalidateSize();
  });
  resizer.observe(el);

  // Re-skin on theme toggle: tint the tiles and recolour the overlays.
  const themeWatcher = new MutationObserver(() => {
    tint();
    const p = palette();
    routeLine.setStyle({ color: p.start });
    trailLine.setStyle({ color: p.vehicle });
    startMarker.setStyle({ fillColor: p.start, color: p.ring });
    endMarker.setStyle({ fillColor: p.end, color: p.ring });
    vehicleMarker.setStyle({ fillColor: p.vehicle, color: p.ring });
  });
  themeWatcher.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  return {
    setRoute,
    setMetro(on) {
      if (on === map.hasLayer(metroTiles)) return;
      if (on) {
        metroTiles.addTo(map);
        tint();
      } else {
        metroTiles.remove();
      }
    },
    setTrail(points) {
      trailLine.setLatLngs(points.map(ll));
    },
    setVehicle(p) {
      const first = vehicle === null && p !== null;
      vehicle = p;
      if (!p) {
        vehicleMarker.remove();
        return;
      }
      vehicleMarker.setLatLng(ll(p)).addTo(map);
      // A planned route already frames the view; a live GPS trip has none, so track the vehicle instead.
      if (routePts || !follow) return;
      if (first) map.setView(ll(p), Math.max(map.getZoom(), FOLLOW_ZOOM), { animate: false });
      else if (!map.getBounds().pad(-0.15).contains(ll(p))) map.panTo(ll(p), { animate: true, duration: 0.3 });
    },
    zoomIn: () => void map.zoomIn(),
    zoomOut: () => void map.zoomOut(),
    recenter() {
      follow = true;
      if (vehicle) map.setView(ll(vehicle), Math.max(map.getZoom(), FOLLOW_ZOOM), { animate: true });
      else if (routePts) fit(routePts);
      else map.setView(DEFAULT_CENTER, 11, { animate: true });
    },
    destroy() {
      destroyed = true;
      tiles.off();
      resizer.disconnect();
      themeWatcher.disconnect();
      map.remove();
    },
  };
}
