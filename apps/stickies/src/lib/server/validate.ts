import {
  MAX_NOTE_HTML,
  MAX_POINTS_PER_STROKE,
  NOTE_COLOR_KEYS,
  type NoteColor,
} from "@/lib/config";
import type { NotePatch, Point, Stroke } from "@/lib/types";

const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const isId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);
export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN_RE.test(v);
export const isColor = (v: unknown): v is NoteColor =>
  typeof v === "string" && (NOTE_COLOR_KEYS as string[]).includes(v);

export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.trim().replace(/\s+/g, " ").slice(0, 80);
  return name || null;
}

export function parsePatch(v: unknown): NotePatch | null {
  if (!v || typeof v !== "object") return null;
  const body = v as Record<string, unknown>;
  const patch: NotePatch = {};
  if ("html" in body) {
    if (typeof body.html !== "string" || body.html.length > MAX_NOTE_HTML) return null;
    patch.html = body.html;
  }
  if ("color" in body) {
    if (!isColor(body.color)) return null;
    patch.color = body.color;
  }
  if ("pinned" in body) {
    if (typeof body.pinned !== "boolean") return null;
    patch.pinned = body.pinned;
  }
  return Object.keys(patch).length ? patch : null;
}

const isNum = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;

export function parseStroke(v: unknown): Stroke | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (!isId(s.id) || typeof s.color !== "string" || !HEX_RE.test(s.color)) return null;
  if (!isNum(s.width, 0.5, 40)) return null;
  if (!Array.isArray(s.points) || s.points.length < 1 || s.points.length > MAX_POINTS_PER_STROKE) {
    return null;
  }
  const points: Point[] = [];
  for (const p of s.points) {
    if (!Array.isArray(p) || p.length !== 3) return null;
    if (!isNum(p[0], -1, 10) || !isNum(p[1], -1, 10) || !isNum(p[2], 0, 1)) return null;
    points.push([p[0], p[1], p[2]]);
  }
  return { id: s.id, color: s.color, width: s.width as number, points };
}
