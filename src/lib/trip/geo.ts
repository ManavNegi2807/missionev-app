export interface LatLng {
  lat: number;
  lng: number;
}

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function cumulativeKm(pts: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + haversineKm(pts[i - 1], pts[i]));
  return out;
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Position and heading at `km` along a polyline (clamped to its ends). */
export function pointAtKm(pts: LatLng[], cum: number[], km: number): { pos: LatLng; heading: number } {
  const total = cum[cum.length - 1];
  const d = Math.max(0, Math.min(total, km));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const segLen = cum[i] - cum[i - 1] || 1e-9;
  const t = (d - cum[i - 1]) / segLen;
  const a = pts[i - 1];
  const b = pts[i];
  return {
    pos: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
    heading: bearingDeg(a, b),
  };
}

/** Move a point `meters` to the right of `heading` (used by the route-mismatch demo scenario). */
export function offsetRight(p: LatLng, headingDeg: number, meters: number): LatLng {
  const h = rad(headingDeg + 90);
  const dy = Math.cos(h) * meters;
  const dx = Math.sin(h) * meters;
  return { lat: p.lat + dy / 110574, lng: p.lng + dx / (111320 * Math.cos(rad(p.lat))) };
}

/** Shortest distance (metres) from `p` to a polyline, plus the distance along it (km). */
export function projectOnPolyline(p: LatLng, pts: LatLng[], cum: number[]): { distM: number; alongKm: number } {
  const lat0 = p.lat;
  const kx = 111.32 * Math.cos(rad(lat0));
  const ky = 110.574;
  const px = p.lng * kx;
  const py = p.lat * ky;
  let best = { distM: Infinity, alongKm: 0 };
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].lng * kx;
    const ay = pts[i - 1].lat * ky;
    const bx = pts[i].lng * kx;
    const by = pts[i].lat * ky;
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy || 1e-12;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
    const dx = px - (ax + vx * t);
    const dy = py - (ay + vy * t);
    const distM = Math.hypot(dx, dy) * 1000;
    if (distM < best.distM) best = { distM, alongKm: cum[i - 1] + t * (cum[i] - cum[i - 1]) };
  }
  return best;
}

export function boundsOf(pts: LatLng[]) {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * step)]);
  return out;
}
