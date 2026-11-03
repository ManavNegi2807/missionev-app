"use client";

import { useEffect, useRef } from "react";
import { hasFinePointer, prefersReducedMotion } from "./use-pointer";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: 0 | 1;
}

const LINK = 128; // px: nodes closer than this are joined by a line
const REACH = 190; // px: how far the cursor's pull and its lines extend

/** Any CSS colour -> [r, g, b], by letting the canvas normalise it. */
function rgbOf(ctx: CanvasRenderingContext2D, css: string): [number, number, number] {
  ctx.fillStyle = "#000";
  ctx.fillStyle = css.trim() || "#000";
  const v = ctx.fillStyle as string;
  if (v.startsWith("#")) {
    const n = Number.parseInt(v.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = v.match(/\d+(\.\d+)?/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
}

/**
 * A drifting network of "stops" joined by lines, like a transit map that is alive. Near the cursor the nodes lean toward it
 * and light up lines to it; a click sends a ripple through them. Colours follow the theme and the node count follows the
 * area. It pauses when off screen or in a background tab, and draws one still frame for reduced-motion visitors.
 */
export function NetworkCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;

    const still = prefersReducedMotion();
    const interactive = !still && hasFinePointer();
    let w = 0;
    let h = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let raf = 0;
    let onScreen = true;
    let last = 0;
    const cursor = { x: -9999, y: -9999, on: false };
    const ripple = { x: 0, y: 0, age: 99 };
    let lime: [number, number, number] = [8, 127, 82];
    let cyan: [number, number, number] = [11, 111, 168];
    let dark = false;

    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      lime = rgbOf(ctx, cs.getPropertyValue("--color-lime"));
      cyan = rgbOf(ctx, cs.getPropertyValue("--color-cyan"));
      dark = document.documentElement.dataset.theme === "dark";
    };

    const targetCount = () => Math.round(Math.min(96, Math.max(26, (w * h) / 15000)));
    const seed = () => {
      nodes = Array.from({ length: targetCount() }, () => {
        const a = Math.random() * Math.PI * 2;
        const s = 0.12 + Math.random() * 0.28;
        return { x: Math.random() * w, y: Math.random() * h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.4 + Math.random() * 1.8, hue: Math.random() < 0.62 ? 0 : 1 };
      });
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      const oldW = w;
      const oldH = h;
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A small resize (a phone's URL bar sliding away) keeps the same nodes, rescaled; only a big one reseeds.
      const want = targetCount();
      if (nodes.length === 0 || oldW === 0 || oldH === 0 || Math.abs(nodes.length - want) > want * 0.25) seed();
      else {
        for (const n of nodes) {
          n.x *= w / oldW;
          n.y *= h / oldH;
        }
      }
      if (still) draw(0);
    };

    const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
    // Light backgrounds need a little more ink than dark ones for the same visibility.
    const ink = () => (dark ? 1 : 1.35);

    const step = (dt: number) => {
      for (const n of nodes) {
        if (cursor.on) {
          const dx = cursor.x - n.x;
          const dy = cursor.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < REACH && d > 1) {
            const f = (1 - d / REACH) * 0.06 * dt;
            n.vx += (dx / d) * f;
            n.vy += (dy / d) * f;
          }
        }
        if (ripple.age < 1.2) {
          const dx = n.x - ripple.x;
          const dy = n.y - ripple.y;
          const d = Math.hypot(dx, dy) || 1;
          const front = ripple.age * 520;
          if (Math.abs(d - front) < 70) {
            const f = (1 - Math.abs(d - front) / 70) * 0.9;
            n.vx += (dx / d) * f;
            n.vy += (dy / d) * f;
          }
        }
        // ease back toward a gentle cruising speed so nodes never freeze or fly off
        const sp = Math.hypot(n.vx, n.vy);
        const cruise = 0.3;
        if (sp > cruise) {
          const k = 1 - Math.min(0.08, 0.02 * dt) * (1 - cruise / sp);
          n.vx *= k;
          n.vy *= k;
        }
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < -20) n.x = w + 20;
        else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        else if (n.y > h + 20) n.y = -20;
      }
      if (ripple.age < 1.2) ripple.age += dt / 60;
    };

    function draw(dt: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      if (dt > 0) step(dt);
      const k = ink();

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          if (dx > LINK || dx < -LINK) continue;
          const d = Math.hypot(dx, a.y - b.y);
          if (d > LINK) continue;
          ctx.strokeStyle = rgba(cyan, (1 - d / LINK) * 0.3 * k);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        let lit = 0;
        if (cursor.on) {
          const d = Math.hypot(cursor.x - n.x, cursor.y - n.y);
          if (d < REACH) {
            lit = 1 - d / REACH;
            ctx.strokeStyle = rgba(lime, lit * 0.65 * k);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cursor.x, cursor.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = rgba(lit > 0.05 ? lime : n.hue === 0 ? lime : cyan, Math.min(1, (0.5 + lit * 0.5) * k));
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + lit * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (cursor.on) {
        const g = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, 46);
        g.addColorStop(0, rgba(lime, 0.34 * k));
        g.addColorStop(1, rgba(lime, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 46, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ripple.age < 1.2) {
        ctx.strokeStyle = rgba(lime, (1 - ripple.age / 1.2) * 0.5 * k);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.age * 520, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const frame = (t: number) => {
      raf = 0;
      if (!onScreen || document.hidden) return;
      const dt = Math.min(3, last ? (t - last) / 16.667 : 1);
      last = t;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (still || raf || !onScreen || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = host.getBoundingClientRect();
      cursor.x = e.clientX - r.left;
      cursor.y = e.clientY - r.top;
      cursor.on = true;
    };
    const onLeave = () => {
      cursor.on = false;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || (e.target as HTMLElement).closest("a,button,input,label")) return;
      const r = host.getBoundingClientRect();
      ripple.x = e.clientX - r.left;
      ripple.y = e.clientY - r.top;
      ripple.age = 0;
    };

    readTheme();
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen) start();
    });
    io.observe(host);
    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);
    const mo = new MutationObserver(() => {
      readTheme();
      if (still) draw(0);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (interactive) {
      host.addEventListener("pointermove", onMove, { passive: true });
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("pointerdown", onDown);
    }
    start();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} data-network-canvas />;
}
