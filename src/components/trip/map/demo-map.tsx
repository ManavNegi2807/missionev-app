"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { bearingDeg, boundsOf, type LatLng } from "@/lib/trip/geo";
import type { MapHandle } from "@/lib/maps/azure";
import type { MapViewProps } from "./types";

const W = 1000;
const H = 640;
const PAD = 130;
const FALLBACK: LatLng[] = [
  { lat: 28.5494, lng: 77.2519 },
  { lat: 28.6315, lng: 77.2167 },
];

/** Seeded PRNG so the decorative street grid is identical on every render. */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useStreets() {
  return useMemo(() => {
    const r = mulberry32(2026);
    const lines = (step: number, from: number, to: number, horizontal: boolean, keep: number) => {
      const out: { d: string; major: boolean }[] = [];
      for (let p = from; p < to; p += step * (0.7 + r() * 0.7)) {
        if (r() > keep) continue;
        const a = -500 + r() * 500;
        const b = 1500 - r() * 500;
        const kink = (r() - 0.5) * 14;
        out.push({
          d: horizontal ? `M${a} ${p} Q ${(a + b) / 2} ${p + kink} ${b} ${p}` : `M${p} ${a} Q ${p + kink} ${(a + b) / 2} ${p} ${b}`,
          major: r() > 0.86,
        });
      }
      return out;
    };
    return {
      grid: [...lines(46, -500, 1200, true, 0.8), ...lines(60, -500, 1500, false, 0.8)],
      diag: [...lines(130, -500, 1500, true, 0.5)],
    };
  }, []);
}

export const DemoMapView = forwardRef<MapHandle, MapViewProps>(function DemoMapView({ route, trail, position, source, recording }, ref) {
  const streets = useStreets();
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  /* ----- projection: fit the planned route (simulated) or the captured trail (GPS) ----- */
  const fitPts = useMemo<LatLng[]>(() => {
    if (source === "simulated" && route) return route.points;
    if (trail.length) return trail;
    return position ? [position] : FALLBACK;
  }, [source, route, trail, position]);

  const proj = useMemo(() => {
    const b = boundsOf(fitPts);
    const midLat = (b.minLat + b.maxLat) / 2;
    const midLng = (b.minLng + b.maxLng) / 2;
    const kx = Math.cos((midLat * Math.PI) / 180);
    const dx = Math.max((b.maxLng - b.minLng) * kx, 0.004);
    const dy = Math.max(b.maxLat - b.minLat, 0.004);
    const scale = Math.min((W - 2 * PAD) / dx, (H - 2 * PAD) / dy);
    return (p: LatLng) => ({ x: W / 2 + (p.lng - midLng) * kx * scale, y: H / 2 - (p.lat - midLat) * scale });
  }, [fitPts]);

  const pathOf = (pts: LatLng[]) => pts.map((p, i) => `${i ? "L" : "M"}${proj(p).x.toFixed(1)} ${proj(p).y.toFixed(1)}`).join(" ");

  const clamp = (v: { scale: number; tx: number; ty: number }) => {
    const mx = (W * (v.scale - 1)) / 2 + 160;
    const my = (H * (v.scale - 1)) / 2 + 160;
    return { scale: v.scale, tx: Math.max(-mx, Math.min(mx, v.tx)), ty: Math.max(-my, Math.min(my, v.ty)) };
  };
  const zoomBy = (f: number) => setView((v) => clamp({ ...v, scale: Math.max(1, Math.min(4, v.scale * f)) }));
  const recenter = () => {
    setView((v) => {
      if (position && v.scale > 1) {
        const p = proj(position);
        return clamp({ scale: v.scale, tx: -(p.x - W / 2) * v.scale, ty: -(p.y - H / 2) * v.scale });
      }
      return { scale: 1, tx: 0, ty: 0 };
    });
  };
  useImperativeHandle(ref, () => ({ zoomIn: () => zoomBy(1.6), zoomOut: () => zoomBy(1 / 1.6), recenter }));

  const unitsPerPx = () => {
    const r = box.current?.getBoundingClientRect();
    return r ? 1 / Math.min(r.width / W, r.height / H) : 1;
  };

  const transform = `translate(${W / 2 + view.tx} ${H / 2 + view.ty}) scale(${view.scale}) translate(${-W / 2} ${-H / 2})`;
  const inv = 1 / view.scale;

  const startPt = source === "simulated" && route ? route.points[0] : (trail[0] ?? null);
  const endPt = source === "simulated" && route ? route.points[route.points.length - 1] : null;
  const heading =
    trail.length > 1 ? bearingDeg(trail[Math.max(0, trail.length - 8)], trail[trail.length - 1]) : route ? bearingDeg(route.points[0], route.points[1]) : 0;
  const mid = route ? route.points[Math.floor(route.points.length / 2)] : null;

  const label = (text: string, x: number, y: number, tone: "cyan" | "lime") => {
    const w = text.length * 7.5 + 18;
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect x={0} y={-12} width={w} height={22} rx={6} fill="var(--color-panel)" stroke={tone === "cyan" ? "var(--color-cyan)" : "var(--color-lime)"} strokeOpacity={0.55} />
        <text x={8} y={3} fontSize={11} fill="var(--color-fg)" fontFamily="var(--font-geist-mono), monospace" letterSpacing={0.8}>
          {text}
        </text>
      </g>
    );
  };

  return (
    <div
      ref={box}
      tabIndex={0}
      role="application"
      aria-label="Demo map. Drag to pan. Plus and minus keys zoom, arrow keys pan, 0 recentres."
      className="absolute inset-0 cursor-grab touch-none bg-[var(--map-bg)] outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 active:cursor-grabbing"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const u = unitsPerPx();
        const dx = (e.clientX - drag.current.x) * u;
        const dy = (e.clientY - drag.current.y) * u;
        drag.current = { x: e.clientX, y: e.clientY };
        setView((v) => clamp({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        const step = 40;
        if (e.key === "+" || e.key === "=") zoomBy(1.6);
        else if (e.key === "-" || e.key === "_") zoomBy(1 / 1.6);
        else if (e.key === "0") recenter();
        else if (e.key === "ArrowLeft") setView((v) => clamp({ ...v, tx: v.tx + step }));
        else if (e.key === "ArrowRight") setView((v) => clamp({ ...v, tx: v.tx - step }));
        else if (e.key === "ArrowUp") setView((v) => clamp({ ...v, ty: v.ty + step }));
        else if (e.key === "ArrowDown") setView((v) => clamp({ ...v, ty: v.ty - step }));
        else return;
        e.preventDefault();
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="size-full select-none" aria-hidden>
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity="0" />
          </radialGradient>
          <filter id="lime-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={-600} y={-600} width={W + 1200} height={H + 1200} fill="var(--map-bg)" />
        <rect x={-600} y={-600} width={W + 1200} height={H + 1200} fill="url(#map-glow)" />

        <g transform={transform}>
          {/* decorative, non-geographic street network */}
          <g transform="rotate(-12 500 320)" fill="none" strokeLinecap="round">
            {streets.grid.map((l, i) => (
              <path key={i} d={l.d} stroke="var(--map-street)" strokeOpacity={l.major ? 0.2 : 0.09} strokeWidth={l.major ? 2.4 : 1.1} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          <g transform="rotate(38 500 320)" fill="none" strokeLinecap="round">
            {streets.diag.map((l, i) => (
              <path key={i} d={l.d} stroke="var(--map-street)" strokeOpacity={0.08} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          <path d="M-100 560 C 250 470, 420 640, 700 520 S 1050 430, 1150 480" fill="none" stroke="var(--color-cyan)" strokeOpacity={0.07} strokeWidth={26} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <ellipse cx={500} cy={330} rx={430} ry={260} fill="none" stroke="var(--map-street)" strokeOpacity={0.16} strokeWidth={3} strokeDasharray="1 0" vectorEffect="non-scaling-stroke" />

          {/* planned (illustrative) route */}
          {source === "simulated" && route && (
            <path
              d={pathOf(route.points)}
              fill="none"
              stroke="var(--color-cyan)"
              strokeOpacity={0.55}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="3 9"
              className="route-flow"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* travelled trail */}
          {trail.length > 1 && (
            <path d={pathOf(trail)} fill="none" stroke="var(--color-lime)" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" filter="url(#lime-glow)" vectorEffect="non-scaling-stroke" />
          )}

          {/* markers (counter-scaled so they stay a constant on-screen size) */}
          {mid && source === "simulated" && route && (
            <g transform={`translate(${proj(mid).x} ${proj(mid).y}) scale(${inv})`}>
              <g transform="translate(-34 -34)">
                <rect width={68} height={22} rx={11} fill="var(--color-panel)" stroke="var(--color-line-strong)" />
                <text x={34} y={15} textAnchor="middle" fontSize={11} fill="var(--color-fg)" fontFamily="var(--font-geist-mono), monospace">
                  {route.lengthKm.toFixed(1)} km
                </text>
              </g>
            </g>
          )}
          {startPt && (
            <g transform={`translate(${proj(startPt).x} ${proj(startPt).y}) scale(${inv})`}>
              <circle r={9} fill="var(--color-panel)" stroke="var(--color-cyan)" strokeWidth={2.5} />
              <circle r={3.5} fill="var(--color-cyan)" />
              {label(`START · ${route && source === "simulated" ? route.fromLabel : "TRIP START"}`, 14, -16, "cyan")}
            </g>
          )}
          {endPt && route && (
            <g transform={`translate(${proj(endPt).x} ${proj(endPt).y}) scale(${inv})`}>
              <rect x={-8} y={-8} width={16} height={16} rx={3} transform="rotate(45)" fill="var(--color-panel)" stroke="var(--color-fg)" strokeWidth={2.5} />
              <circle r={3} fill="var(--color-fg)" />
              {label(`DEST · ${route.toLabel}`, 14, 26, "lime")}
            </g>
          )}
          {/* vehicle indicator */}
          {position && (
            <g transform={`translate(${proj(position).x} ${proj(position).y}) scale(${inv})`}>
              {recording && <circle r={16} fill="none" stroke="var(--color-lime)" strokeOpacity={0.6} className="pulse-ring" />}
              <circle r={10} fill="var(--color-panel)" stroke="var(--color-lime)" strokeWidth={2.5} />
              <path d="M0 -5 L4 4 L0 2 L-4 4 Z" fill="var(--color-lime)" transform={`rotate(${heading})`} />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
});
