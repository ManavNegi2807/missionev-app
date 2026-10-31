import type { LatLng } from "@/lib/trip/geo";
import type { MapHandle } from "./azure";

/**
 * Google Maps adapter (Maps JavaScript API). The map is created ONLY when NEXT_PUBLIC_GOOGLE_MAPS_KEY is set.
 *
 * NOTE: a NEXT_PUBLIC_ key is visible to every visitor. In Google Cloud Console enable "Maps JavaScript API",
 * turn billing on, and restrict the key to HTTP referrers (your domain + http://localhost:3000/*) and to that API.
 */
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
export const googleConfigured = GOOGLE_MAPS_KEY.length > 0;

declare global {
  interface Window {
    /** Google calls this when the key is invalid, restricted for this origin, or billing / the API isn't enabled. */
    gm_authFailure?: () => void;
    __missionevGoogleMapsReady?: () => void;
  }
}

export interface GoogleMapController extends MapHandle {
  setMetro(on: boolean): void;
  setRoute(points: LatLng[] | null): void;
  setTrail(points: LatLng[]): void;
  setVehicle(p: LatLng | null): void;
  destroy(): void;
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const FOLLOW_ZOOM = 16;
/** A key that loads but never renders tiles (blocked network, quota) shouldn't leave "loading…" on screen forever. */
const READY_TIMEOUT_MS = 15_000;

/** Classic JSON style for the dark theme (the light theme keeps Google's default look). */
const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

const authFailureHandlers = new Set<() => void>();
let loader: Promise<void> | null = null;

/** Loads the Maps JS API once per page (React StrictMode and remounts share the same script). */
function loadGoogleMaps(): Promise<void> {
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    if (typeof google !== "undefined" && typeof google.maps?.importLibrary === "function") {
      resolve();
      return;
    }
    window.gm_authFailure = () => authFailureHandlers.forEach((h) => h());
    window.__missionevGoogleMapsReady = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&callback=__missionevGoogleMapsReady`;
    s.async = true;
    s.onerror = () => {
      s.remove();
      reject(new Error("The Google Maps script could not be loaded."));
    };
    document.head.appendChild(s);
  });
  // Allow a retry after a failed load; the caller still receives the rejection from `loader` itself.
  loader.catch(() => {
    loader = null;
  });
  return loader;
}

export async function createGoogleMap(
  el: HTMLElement,
  opts: { route: LatLng[] | null; onReady(): void; onError(message: string): void },
): Promise<GoogleMapController> {
  if (!googleConfigured) throw new Error("Google Maps key is not configured.");
  await loadGoogleMaps();
  const { Map: GMap, Polyline, Circle, TransitLayer } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
  const { LatLngBounds } = (await google.maps.importLibrary("core")) as google.maps.CoreLibrary;

  const root = document.documentElement;
  const isDark = () => root.dataset.theme === "dark";
  const css = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
  const palette = () => ({ start: css("--color-cyan"), end: css("--color-fg"), vehicle: css("--color-lime"), ring: css("--color-panel") });

  let destroyed = false;
  let ready = false;
  const fail = (message: string) => {
    if (!destroyed) opts.onError(message);
  };
  const onAuthFailure = () => fail("Google Maps rejected the API key. Check that the Maps JavaScript API is enabled, billing is on, and the key allows this site.");
  authFailureHandlers.add(onAuthFailure);

  const map = new GMap(el, {
    center: DEFAULT_CENTER,
    zoom: 11,
    minZoom: 3,
    disableDefaultUI: true,
    gestureHandling: "greedy",
    clickableIcons: false,
    backgroundColor: css("--map-bg") || undefined,
    styles: isDark() ? DARK_STYLE : undefined,
  });

  const readyTimer = setTimeout(() => {
    if (!ready) fail("Google Maps didn't finish loading.");
  }, READY_TIMEOUT_MS);
  google.maps.event.addListenerOnce(map, "tilesloaded", () => {
    if (destroyed) return;
    ready = true;
    clearTimeout(readyTimer);
    opts.onReady();
  });

  const pal = palette();
  const routeIcons = (color: string): google.maps.IconSequence[] => [
    { icon: { path: "M 0,-1 0,1", strokeOpacity: 0.65, strokeColor: color, scale: 3 }, offset: "0", repeat: "12px" },
  ];
  // A zero-opacity line carrying a repeated dash symbol is how the Maps API draws a dashed route.
  const routeLine = new Polyline({ map, path: [], strokeOpacity: 0, icons: routeIcons(pal.start), clickable: false });
  const trailLine = new Polyline({ map, path: [], strokeColor: pal.vehicle, strokeOpacity: 0.95, strokeWeight: 5, clickable: false, zIndex: 2 });

  // Dots are Circles (sized in metres), resized on zoom so they keep a constant on-screen size.
  interface Dot {
    circle: google.maps.Circle;
    px: number;
    at: LatLng | null;
  }
  const dot = (color: string, px: number): Dot => ({
    circle: new Circle({ center: DEFAULT_CENTER, radius: 1, fillColor: color, fillOpacity: 1, strokeColor: pal.ring, strokeOpacity: 1, strokeWeight: 2, clickable: false, zIndex: 3 }),
    px,
    at: null,
  });
  const startDot = dot(pal.start, 7);
  const endDot = dot(pal.end, 7);
  const vehicleDot = dot(pal.vehicle, 9);
  const dots = [startDot, endDot, vehicleDot];
  const metersPerPx = (lat: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** (map.getZoom() ?? 11);
  const place = (d: Dot, p: LatLng | null) => {
    d.at = p;
    if (!p) {
      d.circle.setMap(null);
      return;
    }
    d.circle.setCenter(p);
    d.circle.setRadius(d.px * metersPerPx(p.lat));
    d.circle.setMap(map);
  };
  map.addListener("zoom_changed", () => dots.forEach((d) => d.at && d.circle.setRadius(d.px * metersPerPx(d.at.lat))));

  let vehicle: LatLng | null = null;
  let routePts: LatLng[] | null = null;
  /** Follow the vehicle until the user pans away; "recenter" turns it back on. */
  let follow = true;

  const fit = (pts: LatLng[]) => {
    if (!pts.length) return;
    const b = new LatLngBounds();
    pts.forEach((p) => b.extend(p));
    map.fitBounds(b, 70);
  };
  const inView = (p: LatLng) => {
    const b = map.getBounds();
    if (!b) return true;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    const padLat = (ne.lat() - sw.lat()) * 0.15;
    const padLng = (ne.lng() - sw.lng()) * 0.15;
    return p.lat > sw.lat() + padLat && p.lat < ne.lat() - padLat && p.lng > sw.lng() + padLng && p.lng < ne.lng() - padLng;
  };

  const setRoute = (points: LatLng[] | null) => {
    routePts = points && points.length > 1 ? points : null;
    routeLine.setPath(routePts ?? []);
    place(startDot, routePts ? routePts[0] : null);
    place(endDot, routePts ? routePts[routePts.length - 1] : null);
    if (routePts) fit(routePts);
  };
  setRoute(opts.route);

  map.addListener("dragstart", () => {
    follow = false;
  });

  // Re-skin on theme toggle: swap the map style and recolour the overlays.
  const themeWatcher = new MutationObserver(() => {
    const p = palette();
    map.setOptions({ styles: isDark() ? DARK_STYLE : null });
    routeLine.setOptions({ icons: routeIcons(p.start) });
    trailLine.setOptions({ strokeColor: p.vehicle });
    for (const [d, color] of [[startDot, p.start], [endDot, p.end], [vehicleDot, p.vehicle]] as const) {
      d.circle.setOptions({ fillColor: color, strokeColor: p.ring });
    }
  });
  themeWatcher.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  // Google's own transit layer: metro / rail lines and stations drawn by Google, no extra key or request needed.
  const transit = new TransitLayer();

  return {
    setRoute,
    setMetro: (on) => transit.setMap(on ? map : null),
    setTrail(points) {
      trailLine.setPath(points);
    },
    setVehicle(p) {
      const first = vehicle === null && p !== null;
      vehicle = p;
      place(vehicleDot, p);
      // A planned route already frames the view; a live GPS trip has none, so track the vehicle instead.
      if (!p || routePts || !follow) return;
      if (first) {
        map.setCenter(p);
        map.setZoom(Math.max(map.getZoom() ?? 11, FOLLOW_ZOOM));
      } else if (!inView(p)) {
        map.panTo(p);
      }
    },
    zoomIn: () => map.setZoom((map.getZoom() ?? 11) + 1),
    zoomOut: () => map.setZoom((map.getZoom() ?? 11) - 1),
    recenter() {
      follow = true;
      if (vehicle) {
        map.panTo(vehicle);
        map.setZoom(Math.max(map.getZoom() ?? 11, FOLLOW_ZOOM));
      } else if (routePts) fit(routePts);
      else {
        map.setCenter(DEFAULT_CENTER);
        map.setZoom(11);
      }
    },
    destroy() {
      destroyed = true;
      clearTimeout(readyTimer);
      authFailureHandlers.delete(onAuthFailure);
      themeWatcher.disconnect();
      google.maps.event.clearInstanceListeners(map);
      transit.setMap(null);
      routeLine.setMap(null);
      trailLine.setMap(null);
      dots.forEach((d) => d.circle.setMap(null));
      el.replaceChildren();
    },
  };
}
