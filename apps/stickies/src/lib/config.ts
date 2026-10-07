/**
 * Set when the app is served under a sub-path (e.g. /apps/stickies on lizstudio.au).
 * Next adds it to links and navigation, but not to fetch/EventSource URLs, so use apiUrl().
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const apiUrl = (path: string) => `${BASE_PATH}${path}`;

/** Max sticky notes a chapter can hold. Enforced by the server. */
export const MAX_NOTES_PER_CHAPTER = 10;

/** Max characters of rich-text HTML stored per note. */
export const MAX_NOTE_HTML = 50_000;

/** Max pen strokes per note, and points per stroke. */
export const MAX_STROKES_PER_NOTE = 1_000;
export const MAX_POINTS_PER_STROKE = 4_000;

export const NOTE_COLORS = {
  yellow: { paper: "#fff3a3", edge: "#f5e27a", label: "Yellow" },
  pink: { paper: "#ffd1e3", edge: "#f9b5cf", label: "Pink" },
  blue: { paper: "#cbe7ff", edge: "#a9d4fa", label: "Blue" },
  green: { paper: "#d2f4c8", edge: "#b2e6a3", label: "Green" },
  orange: { paper: "#ffdcb3", edge: "#fbc68b", label: "Orange" },
  purple: { paper: "#e6dcff", edge: "#cfc0fb", label: "Purple" },
} as const;

export type NoteColor = keyof typeof NOTE_COLORS;
export const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[];

export const PEN_COLORS = ["#1f1f1f", "#2563eb", "#dc2626", "#16a34a"] as const;

/** True when the browser should talk to Supabase Realtime instead of the dev relay. */
export const SUPABASE_REALTIME_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
