import type { LatLng } from "@/lib/trip/geo";

/**
 * Azure Maps adapter. The real map is created ONLY when NEXT_PUBLIC_AZURE_MAPS_KEY is set.
 * NOTE: a NEXT_PUBLIC_ key is visible to every visitor — use a key restricted to your domain,
 * or switch to Microsoft Entra auth, before deploying.
 */
export const AZURE_MAPS_KEY = process.env.NEXT_PUBLIC_AZURE_MAPS_KEY ?? "";
export const azureConfigured = AZURE_MAPS_KEY.length > 0;

export interface MapHandle {
  zoomIn(): void;
  zoomOut(): void;
  recenter(): void;
  /** Show / hide metro lines and stations. Only basemaps that can draw them implement this. */
  setMetro?(on: boolean): void;
}

export interface AzureMapController extends MapHandle {
  setRoute(points: LatLng[] | null): void;
  setTrail(points: LatLng[]): void;
  setVehicle(p: LatLng | null): void;
  destroy(): void;
}

const CSS_URL = "https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.css";

function ensureCss() {
  if (document.querySelector(`link[data-azure-maps-css]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_URL;
  link.dataset.azureMapsCss = "true";
  document.head.appendChild(link);
}

const dot = (bg: string, ring: string) =>
  `<div style="width:14px;height:14px;border-radius:9999px;background:${bg};border:2px solid ${ring};box-shadow:0 0 12px ${bg}"></div>`;

export async function createAzureMap(
  el: HTMLElement,
  opts: { route: LatLng[] | null; onReady(): void; onError(message: string): void },
): Promise<AzureMapController> {
  if (!azureConfigured) throw new Error("Azure Maps key is not configured.");
  ensureCss();
  const mod = (await import("azure-maps-control")) as unknown as { default?: typeof import("azure-maps-control") } & typeof import("azure-maps-control");
  const atlas = mod.default ?? mod;

  // Azure Maps takes literal colours, so pick the palette for the theme active when the map is created.
  const dark = document.documentElement.dataset.theme === "dark";
  const pal = dark
    ? { style: "grayscale_dark", start: "#43D9E8", end: "#EDF3F7", vehicle: "#B9F66A", ring: "#0C1119" }
    : { style: "grayscale_light", start: "#0B6FA8", end: "#0B1220", vehicle: "#087F52", ring: "#FFFFFF" };

  const start = opts.route?.[0] ?? { lat: 28.6139, lng: 77.209 };
  const map = new atlas.Map(el, {
    authOptions: { authType: atlas.AuthenticationType.subscriptionKey, subscriptionKey: AZURE_MAPS_KEY },
    style: pal.style,
    center: [start.lng, start.lat],
    zoom: 11,
    language: "en-US",
    showFeedbackLink: false,
  });

  const routeSource = new atlas.source.DataSource();
  const trailSource = new atlas.source.DataSource();
  const startMarker = new atlas.HtmlMarker({ htmlContent: dot(pal.start, pal.ring), visible: false });
  const endMarker = new atlas.HtmlMarker({ htmlContent: dot(pal.end, pal.ring), visible: false });
  const vehicleMarker = new atlas.HtmlMarker({ htmlContent: dot(pal.vehicle, pal.ring), visible: false });
  let vehicle: LatLng | null = null;
  let routePts: LatLng[] | null = opts.route;
  let ready = false;

  const pos = (p: LatLng): [number, number] => [p.lng, p.lat];
  const fit = (pts: LatLng[]) => {
    if (!pts.length) return;
    map.setCamera({ bounds: atlas.data.BoundingBox.fromPositions(pts.map(pos)), padding: 70, type: "ease", duration: 400 });
  };
  const applyRoute = () => {
    routeSource.clear();
    if (routePts && routePts.length > 1) {
      routeSource.add(new atlas.data.LineString(routePts.map(pos)));
      startMarker.setOptions({ position: pos(routePts[0]), visible: true });
      endMarker.setOptions({ position: pos(routePts[routePts.length - 1]), visible: true });
      fit(routePts);
    } else {
      startMarker.setOptions({ visible: false });
      endMarker.setOptions({ visible: false });
    }
  };

  map.events.add("ready", () => {
    map.sources.add(routeSource);
    map.sources.add(trailSource);
    map.layers.add(new atlas.layer.LineLayer(routeSource, undefined, { strokeColor: pal.start, strokeWidth: 3, strokeOpacity: 0.6, strokeDashArray: [2, 3] }));
    map.layers.add(new atlas.layer.LineLayer(trailSource, undefined, { strokeColor: pal.vehicle, strokeWidth: 4 }));
    map.markers.add([startMarker, endMarker, vehicleMarker]);
    ready = true;
    applyRoute();
    opts.onReady();
  });
  map.events.add("error", (e: unknown) => {
    const msg = (e as { error?: { message?: string } })?.error?.message ?? "Azure Maps reported an error.";
    opts.onError(msg);
  });

  return {
    setRoute(points) {
      routePts = points;
      if (ready) applyRoute();
    },
    setTrail(points) {
      if (!ready) return;
      trailSource.clear();
      if (points.length > 1) trailSource.add(new atlas.data.LineString(points.map(pos)));
    },
    setVehicle(p) {
      vehicle = p;
      if (!ready) return;
      if (p) vehicleMarker.setOptions({ position: pos(p), visible: true });
      else vehicleMarker.setOptions({ visible: false });
    },
    zoomIn: () => map.setCamera({ zoom: (map.getCamera().zoom ?? 11) + 1, type: "ease", duration: 250 }),
    zoomOut: () => map.setCamera({ zoom: (map.getCamera().zoom ?? 11) - 1, type: "ease", duration: 250 }),
    recenter() {
      if (vehicle) map.setCamera({ center: pos(vehicle), type: "ease", duration: 300 });
      else if (routePts) fit(routePts);
    },
    destroy: () => map.dispose(),
  };
}
