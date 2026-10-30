import { cumulativeKm, type LatLng } from "./geo";

/**
 * ILLUSTRATIVE Delhi demo journeys. Waypoints are approximate landmark positions joined by
 * straight segments — they are NOT road-snapped and NOT a routing-service result.
 */
export interface DemoRoute {
  id: string;
  name: string;
  fromLabel: string;
  toLabel: string;
  points: LatLng[];
  cum: number[];
  lengthKm: number;
}

function make(id: string, name: string, fromLabel: string, toLabel: string, points: LatLng[]): DemoRoute {
  const cum = cumulativeKm(points);
  return { id, name, fromLabel, toLabel, points, cum, lengthKm: cum[cum.length - 1] };
}

export const DEMO_ROUTES: DemoRoute[] = [
  make("cp-nehru", "Connaught Place → Nehru Place", "Connaught Place", "Nehru Place", [
    { lat: 28.6315, lng: 77.2167 },
    { lat: 28.6262, lng: 77.2231 },
    { lat: 28.6129, lng: 77.2295 },
    { lat: 28.5985, lng: 77.2338 },
    { lat: 28.5821, lng: 77.2402 },
    { lat: 28.5662, lng: 77.2471 },
    { lat: 28.5494, lng: 77.2519 },
  ]),
  make("dwarka-t3", "Dwarka Sec 21 → IGI Airport T3", "Dwarka Sec 21", "IGI Airport T3", [
    { lat: 28.5524, lng: 77.0588 },
    { lat: 28.5551, lng: 77.0702 },
    { lat: 28.5538, lng: 77.0831 },
    { lat: 28.5579, lng: 77.0925 },
    { lat: 28.5562, lng: 77.1 },
  ]),
  make("saket-cp", "Saket → Connaught Place", "Saket", "Connaught Place", [
    { lat: 28.5245, lng: 77.2066 },
    { lat: 28.5392, lng: 77.2032 },
    { lat: 28.5559, lng: 77.2003 },
    { lat: 28.5801, lng: 77.2094 },
    { lat: 28.6049, lng: 77.2133 },
    { lat: 28.6315, lng: 77.2167 },
  ]),
];

export const getRoute = (id: string) => DEMO_ROUTES.find((r) => r.id === id) ?? DEMO_ROUTES[0];
