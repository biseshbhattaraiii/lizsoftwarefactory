import "server-only";
import type { NoteColor } from "@/lib/config";
import type { Chapter, Note, NotePatch, Stroke } from "@/lib/types";
import { createFileStore } from "./store-file";
import { createSupabaseStore } from "./store-supabase";

export type CreateNoteResult = { note: Note } | { error: "not_found" | "limit" | "exists" };

/**
 * Everything is addressed by the chapter's secret token: knowing the link is
 * what grants access, so every note/stroke operation is scoped to it.
 */
export interface Store {
  createChapter(name: string): Promise<Chapter>;
  getChapter(token: string): Promise<{ chapter: Chapter; notes: Note[] } | null>;
  renameChapter(token: string, name: string): Promise<Chapter | null>;
  createNote(token: string, id: string, color: NoteColor, max: number): Promise<CreateNoteResult>;
  updateNote(token: string, id: string, patch: NotePatch): Promise<Note | null>;
  deleteNote(token: string, id: string): Promise<boolean>;
  addStroke(token: string, noteId: string, stroke: Stroke, max: number): Promise<boolean>;
  removeStroke(token: string, noteId: string, strokeId: string): Promise<boolean>;
  clearStrokes(token: string, noteId: string): Promise<boolean>;
}

export const supabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

let store: Store | undefined;

export function getStore(): Store {
  store ??= supabaseConfigured()
    ? createSupabaseStore(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
    : createFileStore();
  return store;
}
