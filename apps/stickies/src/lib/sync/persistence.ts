import { apiUrl } from "@/lib/config";
import type { Note, NotePatch, Stroke } from "@/lib/types";

export class SaveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface Loaded {
  notes: Note[];
  title: string | null;
  limit: number | null;
}

/** Where a board's notes are saved. Realtime fan-out is handled separately by the channel. */
export interface Persistence {
  load(): Promise<Loaded>;
  create(note: Note): Promise<Note>;
  update(id: string, patch: NotePatch, opts?: { keepalive?: boolean }): Promise<void>;
  remove(id: string): Promise<void>;
  addStroke(id: string, stroke: Stroke): Promise<void>;
  removeStroke(id: string, strokeId: string): Promise<void>;
  clearStrokes(id: string): Promise<void>;
  rename?(name: string): Promise<void>;
}

async function call<T = void>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new SaveError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** A chapter's notes, stored on the server and addressed by its secret token. */
export function apiPersistence(token: string): Persistence {
  const base = apiUrl(`/api/chapters/${encodeURIComponent(token)}`);
  const note = (id: string) => `${base}/notes/${encodeURIComponent(id)}`;
  return {
    async load() {
      const r = await call<{ chapter: { name: string }; notes: Note[]; limit: number }>(base);
      return { notes: r.notes, title: r.chapter.name, limit: r.limit };
    },
    async create(n) {
      const r = await call<{ note: Note }>(`${base}/notes`, {
        method: "POST",
        body: JSON.stringify({ id: n.id, color: n.color }),
      });
      return r.note;
    },
    update: (id, patch, opts) =>
      call(note(id), { method: "PATCH", body: JSON.stringify(patch), keepalive: opts?.keepalive }),
    remove: (id) => call(note(id), { method: "DELETE" }),
    addStroke: (id, stroke) =>
      call(`${note(id)}/strokes`, { method: "POST", body: JSON.stringify(stroke) }),
    removeStroke: (id, strokeId) =>
      call(`${note(id)}/strokes?id=${encodeURIComponent(strokeId)}`, { method: "DELETE" }),
    clearStrokes: (id) => call(`${note(id)}/strokes`, { method: "DELETE" }),
    rename: (name) => call(base, { method: "PATCH", body: JSON.stringify({ name }) }),
  };
}

/** Personal notes, kept in this browser's localStorage. */
export function localPersistence(key = "stickies:personal:v1"): Persistence {
  const read = (): Note[] => {
    try {
      const notes = JSON.parse(localStorage.getItem(key) ?? "[]") as Note[];
      return Array.isArray(notes) ? notes : [];
    } catch {
      return [];
    }
  };
  const write = (fn: (notes: Note[]) => Note[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(fn(read())));
    } catch {
      throw new SaveError("Your browser's storage is full or blocked.", 507);
    }
  };
  const mapNote = (id: string, fn: (n: Note) => Note) =>
    write((notes) => notes.map((n) => (n.id === id ? fn(n) : n)));

  return {
    load: async () => ({ notes: read(), title: null, limit: null }),
    async create(n) {
      write((notes) => [...notes, n]);
      return n;
    },
    update: async (id, patch) =>
      mapNote(id, (n) => ({ ...n, ...patch, updatedAt: new Date().toISOString() })),
    remove: async (id) => write((notes) => notes.filter((n) => n.id !== id)),
    addStroke: async (id, stroke) =>
      mapNote(id, (n) =>
        n.strokes.some((s) => s.id === stroke.id) ? n : { ...n, strokes: [...n.strokes, stroke] },
      ),
    removeStroke: async (id, strokeId) =>
      mapNote(id, (n) => ({ ...n, strokes: n.strokes.filter((s) => s.id !== strokeId) })),
    clearStrokes: async (id) => mapNote(id, (n) => ({ ...n, strokes: [] })),
  };
}
