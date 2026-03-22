"use client";

import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   DotField — interactive scanline / halftone dot matrix background

   Dots are arranged in a grid. Each dot's base radius is derived from a
   layered noise function that produces organic halftone-like density
   variations (vertical barcode bands, circular ripples, diagonal streaks).

   On hover the cursor creates a radial influence zone that:
   • pushes dots outward from the cursor
   • brightens dots near the cursor
   • scales dots based on distance
   ═══════════════════════════════════════════════════════════════════════════ */

const SPACING = 14;          // px between dot centers
const BASE_R = 1.6;          // base dot radius
const MAX_R = 3.8;           // max dot radius from pattern
const HOVER_RADIUS = 160;    // px — cursor influence zone
const PUSH_STRENGTH = 18;    // px — max displacement
const LERP = 0.08;           // smoothing for mouse position

// simple hash for pseudo-random per-dot variation
function hash(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663);
  h = ((h >> 13) ^ h) * 1274126177;
  return ((h >> 16) ^ h) & 0x7fff;
}

export default function DotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const smoothMouse = useRef({ x: -9999, y: -9999 });
  const raf = useRef<number>(0);
  const time = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouse.current.x = e.clientX - rect.left;
    mouse.current.y = e.clientY - rect.top;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouse.current.x = -9999;
    mouse.current.y = -9999;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    function draw() {
      time.current += 0.003;
      const t = time.current;

      // smooth mouse
      const sm = smoothMouse.current;
      const m = mouse.current;
      sm.x += (m.x - sm.x) * LERP;
      sm.y += (m.y - sm.y) * LERP;

      ctx!.clearRect(0, 0, w, h);

      const cols = Math.ceil(w / SPACING) + 1;
      const rows = Math.ceil(h / SPACING) + 1;
      const hr = HOVER_RADIUS;
      const hr2 = hr * hr;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const bx = col * SPACING;
          const by = row * SPACING;

          // ── pattern layers ──────────────────────────────────────
          // 1) vertical barcode bands
          const barcode = Math.sin(bx * 0.08 + t * 2) * 0.5 + 0.5;
          // 2) circular ripple from center
          const cx = bx - w * 0.5;
          const cy = by - h * 0.5;
          const dist = Math.sqrt(cx * cx + cy * cy);
          const ripple = Math.sin(dist * 0.025 - t * 3) * 0.5 + 0.5;
          // 3) diagonal scanline
          const scan = Math.sin((bx + by) * 0.04 + t * 1.5) * 0.5 + 0.5;
          // 4) per-dot noise
          const noise = (hash(col, row) & 0xff) / 255;

          // combine
          const density = barcode * 0.35 + ripple * 0.3 + scan * 0.2 + noise * 0.15;
          const baseRadius = BASE_R + (MAX_R - BASE_R) * density;

          // ── hover interaction ───────────────────────────────────
          let dx = bx - sm.x;
          let dy = by - sm.y;
          let d2 = dx * dx + dy * dy;
          let drawX = bx;
          let drawY = by;
          let r = baseRadius;
          let alpha = 0.18 + density * 0.22;

          if (d2 < hr2) {
            const d = Math.sqrt(d2);
            const influence = 1 - d / hr;
            const ease = influence * influence * (3 - 2 * influence); // smoothstep

            // push outward
            if (d > 1) {
              const pushAmt = PUSH_STRENGTH * ease;
              drawX += (dx / d) * pushAmt;
              drawY += (dy / d) * pushAmt;
            }

            // scale up near cursor
            r = baseRadius + (MAX_R * 1.2 - baseRadius) * ease;
            // brighten
            alpha = alpha + (0.9 - alpha) * ease;
          }

          // ── draw ────────────────────────────────────────────────
          if (r < 0.3 || alpha < 0.02) continue;

          // color: warm gold near cursor, cool white/grey far
          let color: string;
          if (d2 < hr2) {
            const influence = 1 - Math.sqrt(d2) / hr;
            const ease = influence * influence;
            // interpolate from base grey to warm gold
            const rr = Math.round(200 + 55 * ease);
            const gg = Math.round(200 + 20 * ease - 40 * (1 - ease));
            const bb = Math.round(200 - 80 * ease);
            color = `rgba(${rr},${gg},${bb},${alpha})`;
          } else {
            color = `rgba(200,200,200,${alpha})`;
          }

          ctx!.beginPath();
          ctx!.arc(drawX, drawY, r, 0, Math.PI * 2);
          ctx!.fillStyle = color;
          ctx!.fill();
        }
      }

      raf.current = requestAnimationFrame(draw);
    }

    raf.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <canvas
      ref={canvasRef}
      className="dot-field"
      aria-hidden="true"
    />
  );
}
