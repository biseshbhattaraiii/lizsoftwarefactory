"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { NoteColor } from "@/lib/config";
import type { Member, Note, NotePatch, Stroke } from "@/lib/types";
import type { ChannelFactory, ConnStatus, SyncChannel, SyncEvent } from "./channel";
import { SaveError, type Persistence } from "./persistence";

type Action = { t: "load"; notes: Note[] } | Exclude<SyncEvent, { t: "title" }>;

function reduce(notes: Note[], a: Action): Note[] {
  const map = (id: string, fn: (n: Note) => Note) => notes.map((n) => (n.id === id ? fn(n) : n));
  switch (a.t) {
    case "load":
      return a.notes;
    case "upsert":
      return notes.some((n) => n.id === a.note.id)
        ? map(a.note.id, () => a.note)
        : [...notes, a.note];
    case "patch":
      return map(a.id, (n) => ({ ...n, ...a.patch, updatedAt: a.updatedAt }));
    case "remove":
      return notes.filter((n) => n.id !== a.id);
    case "stroke":
      return map(a.id, (n) =>
        n.strokes.some((s) => s.id === a.stroke.id) ? n : { ...n, strokes: [...n.strokes, a.stroke] },
      );
    case "unstroke":
      return map(a.id, (n) => ({ ...n, strokes: n.strokes.filter((s) => s.id !== a.strokeId) }));
    case "clear":
      return map(a.id, (n) => ({ ...n, strokes: [] }));
  }
}

/** Text is broadcast quickly so others see typing live, but saved less often. */
const SEND_TEXT_MS = 80;
const SAVE_TEXT_MS = 500;
const TYPING_MS = 2_500;

interface PendingText {
  html: string;
  send?: ReturnType<typeof setTimeout>;
  save?: ReturnType<typeof setTimeout>;
}

export interface Board {
  state: "loading" | "ready" | "missing";
  conn: ConnStatus;
  notes: Note[];
  title: string | null;
  limit: number | null;
  members: Member[];
  /** noteId -> name of whoever is typing in it right now. */
  typing: Record<string, string>;
  error: string | null;
  dismissError(): void;
  addNote(color: NoteColor): string | null;
  patchNote(id: string, patch: NotePatch): void;
  removeNote(id: string): void;
  addStroke(id: string, stroke: Stroke): void;
  undoStroke(id: string, strokeId: string): void;
  clearStrokes(id: string): void;
  rename(name: string): void;
}

export function useBoard(opts: {
  room: string;
  persistence: Persistence;
  channel: ChannelFactory;
  me: Member | null;
}): Board {
  const { room, persistence, channel } = opts;
  const [notes, dispatch] = useReducer(reduce, []);
  const [state, setState] = useState<Board["state"]>("loading");
  const [conn, setConn] = useState<ConnStatus>("connecting");
  const [title, setTitle] = useState<string | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const chRef = useRef<SyncChannel | null>(null);
  const meRef = useRef(opts.me);
  const pending = useRef(new Map<string, PendingText>());
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const hasMe = opts.me !== null;

  const load = useCallback(
    () =>
      persistence.load().then(
        (r) => {
          dispatch({ t: "load", notes: r.notes });
          // Keep any text typed since the request started.
          const at = new Date().toISOString();
          for (const [id, p] of pending.current) {
            dispatch({ t: "patch", id, patch: { html: p.html }, updatedAt: at });
          }
          setTitle(r.title);
          setLimit(r.limit);
          setState("ready");
        },
        (e: unknown) => {
          if (e instanceof SaveError && e.status === 404) setState("missing");
          else setError("Couldn't load notes. Check your connection.");
        },
      ),
    [persistence],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const showTyping = useCallback((id: string, name: string) => {
    setTyping((t) => (t[id] === name ? t : { ...t, [id]: name }));
    clearTimeout(typingTimers.current.get(id));
    typingTimers.current.set(
      id,
      setTimeout(() => {
        setTyping((t) => {
          const next = { ...t };
          delete next[id];
          return next;
        });
      }, TYPING_MS),
    );
  }, []);

  // Declared before the channel effect so meRef is set when the channel opens.
  useEffect(() => {
    meRef.current = opts.me;
    if (opts.me) chRef.current?.setMe(opts.me);
  }, [opts.me]);

  useEffect(() => {
    if (!hasMe) return;
    const ch = channel(room, meRef.current!, {
      onEvent(ev, from) {
        if (ev.t === "title") return setTitle(ev.name);
        dispatch(ev);
        if (ev.t === "patch" && ev.patch.html !== undefined) showTyping(ev.id, from.name);
      },
      onMembers: setMembers,
      onStatus: setConn,
      onResync() {
        if (!pending.current.size) void load();
      },
    });
    chRef.current = ch;
    return () => {
      ch.close();
      chRef.current = null;
    };
  }, [room, channel, hasMe, load, showTyping]);

  const send = (ev: SyncEvent) => chRef.current?.send(ev);

  /** Report a failed save, then reload so the screen matches what was actually saved. */
  const failed = useCallback(
    (fallback: string) => (e: unknown) => {
      setError(e instanceof SaveError && e.status < 500 ? e.message : fallback);
      if (!pending.current.size) void load();
    },
    [load],
  );

  const flushText = useCallback(
    (id: string, keepalive = false) => {
      const p = pending.current.get(id);
      if (!p) return;
      clearTimeout(p.save);
      pending.current.delete(id);
      persistence.update(id, { html: p.html }, { keepalive }).catch(failed("Couldn't save your text."));
    },
    [persistence, failed],
  );

  // Save unsaved text when the tab is hidden or closed, and when leaving the board.
  useEffect(() => {
    const flushAll = () => [...pending.current.keys()].forEach((id) => flushText(id, true));
    const onVisibility = () => document.visibilityState === "hidden" && flushAll();
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", onVisibility);
      flushAll();
    };
  }, [flushText]);

  return {
    state,
    conn,
    notes,
    title,
    limit,
    members,
    typing,
    error,
    dismissError: () => setError(null),

    addNote(color) {
      if (limit !== null && notes.length >= limit) {
        setError(`This chapter already has ${limit} notes. Delete one to add another.`);
        return null;
      }
      const at = new Date().toISOString();
      const note: Note = { id: nanoid(12), html: "", color, pinned: false, strokes: [], createdAt: at, updatedAt: at };
      dispatch({ t: "upsert", note });
      persistence.create(note).then(
        (saved) => send({ t: "upsert", note: saved }),
        (e) => {
          dispatch({ t: "remove", id: note.id });
          failed("Couldn't add a note.")(e);
        },
      );
      return note.id;
    },

    patchNote(id, patch) {
      const updatedAt = new Date().toISOString();
      dispatch({ t: "patch", id, patch, updatedAt });
      const { html, ...rest } = patch;
      if (html !== undefined) {
        const p = pending.current.get(id) ?? { html };
        p.html = html;
        pending.current.set(id, p);
        p.send ??= setTimeout(() => {
          p.send = undefined;
          send({ t: "patch", id, patch: { html: p.html }, updatedAt: new Date().toISOString() });
        }, SEND_TEXT_MS);
        clearTimeout(p.save);
        p.save = setTimeout(() => flushText(id), SAVE_TEXT_MS);
      }
      if (Object.keys(rest).length) {
        send({ t: "patch", id, patch: rest, updatedAt });
        persistence.update(id, rest).catch(failed("Couldn't save that change."));
      }
    },

    removeNote(id) {
      const p = pending.current.get(id);
      if (p) {
        clearTimeout(p.save);
        clearTimeout(p.send);
        pending.current.delete(id);
      }
      dispatch({ t: "remove", id });
      send({ t: "remove", id });
      persistence.remove(id).catch(failed("Couldn't delete that note."));
    },

    addStroke(id, stroke) {
      dispatch({ t: "stroke", id, stroke });
      send({ t: "stroke", id, stroke });
      persistence.addStroke(id, stroke).catch(failed("Couldn't save your drawing."));
    },

    undoStroke(id, strokeId) {
      dispatch({ t: "unstroke", id, strokeId });
      send({ t: "unstroke", id, strokeId });
      persistence.removeStroke(id, strokeId).catch(failed("Couldn't undo that stroke."));
    },

    clearStrokes(id) {
      dispatch({ t: "clear", id });
      send({ t: "clear", id });
      persistence.clearStrokes(id).catch(failed("Couldn't clear the drawing."));
    },

    rename(name) {
      setTitle(name);
      send({ t: "title", name });
      persistence.rename?.(name).catch(failed("Couldn't rename the chapter."));
    },
  };
}
