"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Point, Stroke } from "@/lib/types";

/** Stroke widths are stored relative to a note this wide, so drawings scale with the note. */
const REFERENCE_WIDTH = 260;
const PEN_WIDTH = 2.6;

const round = (n: number) => Math.round(n * 10_000) / 10_000;

function segment(ctx: CanvasRenderingContext2D, s: Stroke, a: Point, b: Point, w: number) {
  // Lines thicken a little on bigger notes, but not in proportion, or a full-window note gets marker-thick strokes.
  ctx.lineWidth = s.width * Math.min(w / REFERENCE_WIDTH, 1.5) * (0.5 + b[2]);
  ctx.beginPath();
  ctx.moveTo(a[0] * w, a[1] * w);
  ctx.lineTo(b[0] * w, b[1] * w);
  ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number) {
  ctx.strokeStyle = s.color;
  const pts = s.points;
  if (pts.length === 1) return segment(ctx, s, pts[0], pts[0], w);
  for (let i = 1; i < pts.length; i++) segment(ctx, s, pts[i - 1], pts[i], w);
}

/**
 * Pen layer over the note. Works with mouse, touch, and stylus (pressure
 * changes line weight). Points are stored divided by the note's width.
 */
export function DrawingLayer({
  strokes,
  active,
  color,
  onStroke,
}: {
  strokes: Stroke[];
  active: boolean;
  color: string;
  onStroke(stroke: Stroke): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const live = useRef<Stroke | null>(null);

  const context = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return null;
    const dpr = c.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return { c, ctx, w: c.clientWidth, h: c.clientHeight };
  };

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = c.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    const pw = Math.round(c.clientWidth * dpr);
    const ph = Math.round(c.clientHeight * dpr);
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
    }
    const k = context();
    if (!k) return;
    k.ctx.clearRect(0, 0, k.w, k.h);
    for (const s of strokesRef.current) drawStroke(k.ctx, s, k.w);
    if (live.current) drawStroke(k.ctx, live.current, k.w);
  }, []);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [strokes, redraw]);

  useEffect(() => {
    const c = canvasRef.current!;
    // Use the ResizeObserver of whichever window the note is in (it may be in the PiP window).
    const Observer = c.ownerDocument.defaultView?.ResizeObserver ?? ResizeObserver;
    const ro = new Observer(redraw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [redraw]);

  const toPoint = (e: PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    const pressure = e.pointerType === "mouse" || !e.pressure ? 0.5 : e.pressure;
    return [round((e.clientX - r.left) / r.width), round((e.clientY - r.top) / r.width), round(pressure)];
  };

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!active || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { id: nanoid(12), color, width: PEN_WIDTH, points: [toPoint(e.nativeEvent)] };
    redraw();
  };

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = live.current;
    if (!s) return;
    const k = context();
    if (!k) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = toPoint(ev);
      const prev = s.points[s.points.length - 1];
      if (prev[0] === p[0] && prev[1] === p[1]) continue;
      s.points.push(p);
      k.ctx.strokeStyle = s.color;
      segment(k.ctx, s, prev, p, k.w);
    }
  };

  const onUp = () => {
    const s = live.current;
    live.current = null;
    if (s) onStroke(s);
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label={active ? "Drawing area" : undefined}
      className="absolute inset-0 h-full w-full touch-none"
      style={{ pointerEvents: active ? "auto" : "none", cursor: active ? "crosshair" : undefined }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
