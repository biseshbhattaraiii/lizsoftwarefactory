import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import type { NoteColor } from "@/lib/config";
import type { Chapter, Note, Stroke } from "@/lib/types";
import type { Store } from "./store";

/**
 * Server-side Supabase access with the secret key. The tables have RLS on and
 * no policies, so the browser's publishable key can't read them directly;
 * all reads and writes go through our API routes, gated by the chapter token.
 */
interface ChapterRow {
  id: string;
  token: string;
  name: string;
  created_at: string;
}
interface NoteRow {
  id: string;
  html: string;
  color: NoteColor;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const toChapter = (r: ChapterRow): Chapter => ({ token: r.token, name: r.name, createdAt: r.created_at });
const toNote = (r: NoteRow, strokes: Stroke[] = []): Note => ({
  id: r.id,
  html: r.html,
  color: r.color,
  pinned: r.pinned,
  strokes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const NOTE_COLS = "id, html, color, pinned, created_at, updated_at";

export function createSupabaseStore(url: string, secretKey: string): Store {
  const sb = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const fail = (what: string, error: { message: string }): never => {
    throw new Error(`${what}: ${error.message}`);
  };

  async function chapterId(token: string): Promise<string | null> {
    const { data, error } = await sb.from("chapters").select("id").eq("token", token).maybeSingle();
    if (error) fail("chapter lookup", error);
    return data?.id ?? null;
  }

  /** Confirms the note belongs to the chapter behind `token`. */
  async function ownsNote(token: string, noteId: string): Promise<boolean> {
    const cid = await chapterId(token);
    if (!cid) return false;
    const { data, error } = await sb
      .from("notes")
      .select("id")
      .eq("id", noteId)
      .eq("chapter_id", cid)
      .maybeSingle();
    if (error) fail("note lookup", error);
    return Boolean(data);
  }

  return {
    async createChapter(name) {
      const { data, error } = await sb
        .from("chapters")
        .insert({ token: nanoid(22), name })
        .select()
        .single<ChapterRow>();
      if (error) fail("create chapter", error);
      return toChapter(data!);
    },

    async getChapter(token) {
      const { data: ch, error } = await sb
        .from("chapters")
        .select()
        .eq("token", token)
        .maybeSingle<ChapterRow>();
      if (error) fail("get chapter", error);
      if (!ch) return null;

      const { data: rows, error: notesErr } = await sb
        .from("notes")
        .select(NOTE_COLS)
        .eq("chapter_id", ch.id)
        .returns<NoteRow[]>();
      if (notesErr) fail("list notes", notesErr);

      const ids = (rows ?? []).map((r) => r.id);
      const strokesByNote = new Map<string, Stroke[]>();
      if (ids.length) {
        const { data: strokes, error: sErr } = await sb
          .from("note_strokes")
          .select("note_id, data")
          .in("note_id", ids)
          .order("created_at")
          .returns<{ note_id: string; data: Stroke }[]>();
        if (sErr) fail("list strokes", sErr);
        for (const s of strokes ?? []) {
          const list = strokesByNote.get(s.note_id) ?? [];
          list.push(s.data);
          strokesByNote.set(s.note_id, list);
        }
      }
      return {
        chapter: toChapter(ch),
        notes: (rows ?? []).map((r) => toNote(r, strokesByNote.get(r.id))),
      };
    },

    async renameChapter(token, name) {
      const { data, error } = await sb
        .from("chapters")
        .update({ name })
        .eq("token", token)
        .select()
        .maybeSingle<ChapterRow>();
      if (error) fail("rename chapter", error);
      return data ? toChapter(data) : null;
    },

    async createNote(token, id, color, max) {
      // The limit check and insert happen in one locked transaction (see migration).
      const { data, error } = await sb.rpc("create_note", {
        p_token: token,
        p_id: id,
        p_color: color,
        p_max: max,
      });
      if (error) fail("create note", error);
      const res = data as { status: string; note?: NoteRow };
      if (res.status === "ok" && res.note) return { note: toNote(res.note) };
      return { error: res.status as "not_found" | "limit" | "exists" };
    },

    async updateNote(token, id, patch) {
      const cid = await chapterId(token);
      if (!cid) return null;
      const { data, error } = await sb
        .from("notes")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("chapter_id", cid)
        .select(NOTE_COLS)
        .maybeSingle<NoteRow>();
      if (error) fail("update note", error);
      return data ? toNote(data) : null;
    },

    async deleteNote(token, id) {
      const cid = await chapterId(token);
      if (!cid) return false;
      const { data, error } = await sb
        .from("notes")
        .delete()
        .eq("id", id)
        .eq("chapter_id", cid)
        .select("id");
      if (error) fail("delete note", error);
      return Boolean(data?.length);
    },

    async addStroke(token, noteId, stroke, max) {
      if (!(await ownsNote(token, noteId))) return false;
      const { count, error: cErr } = await sb
        .from("note_strokes")
        .select("id", { count: "exact", head: true })
        .eq("note_id", noteId);
      if (cErr) fail("count strokes", cErr);
      if ((count ?? 0) >= max) return false;
      const { error } = await sb
        .from("note_strokes")
        .upsert({ id: stroke.id, note_id: noteId, data: stroke }, { onConflict: "id", ignoreDuplicates: true });
      if (error) fail("add stroke", error);
      return true;
    },

    async removeStroke(token, noteId, strokeId) {
      if (!(await ownsNote(token, noteId))) return false;
      const { error } = await sb.from("note_strokes").delete().eq("id", strokeId).eq("note_id", noteId);
      if (error) fail("remove stroke", error);
      return true;
    },

    async clearStrokes(token, noteId) {
      if (!(await ownsNote(token, noteId))) return false;
      const { error } = await sb.from("note_strokes").delete().eq("note_id", noteId);
      if (error) fail("clear strokes", error);
      return true;
    },
  };
}
