import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type { Chapter, Note } from "@/lib/types";
import type { Store } from "./store";

/**
 * Development-only store: a JSON file under .data/. Used when Supabase isn't
 * configured so the app runs with zero setup. Not for production (single
 * process, no locking, and serverless filesystems are read-only).
 */
type Db = Record<string, { chapter: Chapter; notes: Note[] }>;

const FILE = path.join(process.cwd(), ".data", "dev-db.json");
const g = globalThis as unknown as { __stickiesDb?: Db };

function db(): Db {
  if (!g.__stickiesDb) {
    try {
      g.__stickiesDb = JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
    } catch {
      g.__stickiesDb = {};
    }
  }
  return g.__stickiesDb;
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(g.__stickiesDb ?? {}));
}

const now = () => new Date().toISOString();

export function createFileStore(): Store {
  const findNote = (token: string, id: string) => db()[token]?.notes.find((n) => n.id === id);

  return {
    async createChapter(name) {
      const chapter: Chapter = { token: nanoid(22), name, createdAt: now() };
      db()[chapter.token] = { chapter, notes: [] };
      save();
      return chapter;
    },

    async getChapter(token) {
      const room = db()[token];
      return room ? structuredClone(room) : null;
    },

    async renameChapter(token, name) {
      const room = db()[token];
      if (!room) return null;
      room.chapter.name = name;
      save();
      return room.chapter;
    },

    async createNote(token, id, color, max) {
      const room = db()[token];
      if (!room) return { error: "not_found" };
      if (room.notes.length >= max) return { error: "limit" };
      if (Object.values(db()).some((r) => r.notes.some((n) => n.id === id))) {
        return { error: "exists" };
      }
      const t = now();
      const note: Note = { id, html: "", color, pinned: false, strokes: [], createdAt: t, updatedAt: t };
      room.notes.push(note);
      save();
      return { note };
    },

    async updateNote(token, id, patch) {
      const note = findNote(token, id);
      if (!note) return null;
      Object.assign(note, patch, { updatedAt: now() });
      save();
      return note;
    },

    async deleteNote(token, id) {
      const room = db()[token];
      const before = room?.notes.length ?? 0;
      if (room) room.notes = room.notes.filter((n) => n.id !== id);
      save();
      return Boolean(room && room.notes.length < before);
    },

    async addStroke(token, noteId, stroke, max) {
      const note = findNote(token, noteId);
      if (!note || note.strokes.length >= max) return false;
      if (!note.strokes.some((s) => s.id === stroke.id)) note.strokes.push(stroke);
      save();
      return true;
    },

    async removeStroke(token, noteId, strokeId) {
      const note = findNote(token, noteId);
      if (!note) return false;
      note.strokes = note.strokes.filter((s) => s.id !== strokeId);
      save();
      return true;
    },

    async clearStrokes(token, noteId) {
      const note = findNote(token, noteId);
      if (!note) return false;
      note.strokes = [];
      save();
      return true;
    },
  };
}
