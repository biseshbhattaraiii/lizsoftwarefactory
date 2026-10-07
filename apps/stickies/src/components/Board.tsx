"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NOTE_COLOR_KEYS } from "@/lib/config";
import type { Board as BoardState } from "@/lib/sync/useBoard";
import { sortNotes, type Note } from "@/lib/types";
import { PlusIcon, PopOutIcon, ReturnIcon, XIcon } from "./icons";
import { NoteCard, type NoteActions } from "./NoteCard";
import { usePip } from "./usePip";

type PipTarget = { kind: "board" } | { kind: "note"; id: string };

const BOARD_PIP = { width: 360, height: 640 };
const NOTE_PIP = { width: 320, height: 340 };

function noteActions(board: BoardState, id: string): NoteActions {
  return {
    onPatch: (patch) => board.patchNote(id, patch),
    onRemove: () => board.removeNote(id),
    onStroke: (s) => board.addStroke(id, s),
    onUndoStroke: (sid) => board.undoStroke(id, sid),
    onClearStrokes: () => board.clearStrokes(id),
  };
}

function Button({
  onClick,
  disabled,
  primary,
  title,
  children,
}: {
  onClick(): void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? "bg-ink text-bg hover:opacity-90"
          : "border border-line bg-surface text-ink hover:bg-line/50"
      }`}
    >
      {children}
    </button>
  );
}

/** Explains why the pop-out can't open here and how to fix it. */
function PipHelp({ insecure, onClose }: { insecure: boolean; onClose(): void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pip-help-title"
        className="w-full max-w-md rounded-xl border border-line bg-surface p-5 text-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <h2 id="pip-help-title" className="flex-1 text-base font-semibold">
            Pop-out isn&apos;t available here
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" autoFocus className="text-muted hover:text-ink">
            <XIcon />
          </button>
        </div>
        {insecure ? (
          <>
            <p className="mt-2 text-muted">
              Chrome only lets secure (https://) sites open windows that stay on top. This site is on http://, so the
              pop-out is blocked until it moves to https://.
            </p>
            <p className="mt-3 font-medium">To use it now in Chrome or Edge:</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted">
              <li>
                Open <code className="rounded bg-line/60 px-1 text-ink">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>
              </li>
              <li>
                Add <code className="rounded bg-line/60 px-1 text-ink">{location.origin}</code> and set it to Enabled
              </li>
              <li>Click Relaunch, then try Pop out again</li>
            </ol>
          </>
        ) : (
          <p className="mt-2 text-muted">
            Your browser doesn&apos;t support windows that stay on top of other apps. Open Stickies in Chrome or Edge on
            a computer to pop notes out.
          </p>
        )}
      </div>
    </div>
  );
}

export function Board({
  board,
  title,
  heading,
  emptyText,
}: {
  board: BoardState;
  /** Shown as the pop-out window's title. */
  title: string;
  heading: ReactNode;
  emptyText: string;
}) {
  const pip = usePip();
  const [target, setTarget] = useState<PipTarget | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pipHelp, setPipHelp] = useState(false);
  const notes = useMemo(() => sortNotes(board.notes), [board.notes]);
  const popped = pip.win ? target : null;
  const full = board.limit !== null && notes.length >= board.limit;

  const add = () => {
    const color = NOTE_COLOR_KEYS[notes.length % NOTE_COLOR_KEYS.length];
    setFocusId(board.addNote(color));
  };

  const popOut = async (t: PipTarget) => {
    if (!pip.supported) return setPipHelp(true);
    try {
      if (await pip.open(t.kind === "board" ? BOARD_PIP : NOTE_PIP, title)) setTarget(t);
    } catch {
      // The browser refused (e.g. no user gesture); nothing to clean up.
    }
  };

  const card = (note: Note, extra: { fill?: boolean; inPip?: boolean } = {}) => (
    <NoteCard
      key={note.id}
      note={note}
      actions={noteActions(board, note.id)}
      typingName={board.typing[note.id]}
      autoFocus={note.id === focusId}
      fill={extra.fill}
      onPopOut={!extra.inPip ? () => popOut({ kind: "note", id: note.id }) : undefined}
      onReturn={extra.inPip ? pip.close : undefined}
    />
  );

  const counter = board.limit !== null && (
    <span className="text-sm tabular-nums text-muted" title={`A chapter can hold up to ${board.limit} notes`}>
      {notes.length}/{board.limit}
    </span>
  );

  const addButton = (
    <Button primary onClick={add} disabled={full || board.state !== "ready"} title={full ? "This chapter is full" : undefined}>
      <PlusIcon /> Add note
    </Button>
  );

  const placeholder = (text: string) => (
    <div className="grid h-[280px] place-items-center rounded-md border-2 border-dashed border-line p-6 text-center text-sm text-muted">
      <div>
        <p>{text}</p>
        <button type="button" onClick={pip.close} className="mt-2 font-medium text-ink underline underline-offset-4">
          Bring it back
        </button>
      </div>
    </div>
  );

  let pipContent: ReactNode = null;
  if (pip.win && popped?.kind === "note") {
    const note = notes.find((n) => n.id === popped.id);
    pipContent = note ? (
      <div className="h-screen">{card(note, { fill: true, inPip: true })}</div>
    ) : (
      <p className="p-6 text-sm text-muted">This note was deleted.</p>
    );
  } else if (pip.win && popped?.kind === "board") {
    pipContent = (
      <div className="min-h-screen p-3">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
          {counter}
          <button
            type="button"
            onClick={add}
            disabled={full}
            aria-label="Add note"
            title="Add note"
            className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-bg disabled:opacity-40"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            onClick={pip.close}
            aria-label="Back to tab"
            title="Back to tab"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface"
          >
            <ReturnIcon />
          </button>
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {notes.map((n) => card(n, { inPip: true }))}
        </div>
        {!notes.length && <p className="py-10 text-center text-sm text-muted">{emptyText}</p>}
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 py-5">
        <div className="min-w-0 flex-1">{heading}</div>
        <div className="flex items-center gap-2">
          {counter}
          <Button onClick={() => popOut({ kind: "board" })} title="Keep this board on top of all your windows">
            <PopOutIcon /> Pop out board
          </Button>
          {addButton}
        </div>
      </div>

      {board.state === "loading" && <p className="py-20 text-center text-sm text-muted">Loading notes…</p>}

      {board.state === "ready" &&
        (popped?.kind === "board" ? (
          placeholder("This board is floating in a pop-out window.")
        ) : notes.length ? (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {notes.map((n) =>
              popped?.kind === "note" && popped.id === n.id ? (
                <div key={n.id}>{placeholder("This note is popped out.")}</div>
              ) : (
                card(n)
              ),
            )}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-line px-6 py-16 text-center">
            <p className="text-muted">{emptyText}</p>
            <div className="mt-4 inline-flex">{addButton}</div>
          </div>
        ))}

      {pipHelp && <PipHelp insecure={pip.insecure} onClose={() => setPipHelp(false)} />}

      {board.error && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-bg shadow-lg"
        >
          <p className="flex-1">{board.error}</p>
          <button type="button" onClick={board.dismissError} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <XIcon />
          </button>
        </div>
      )}

      {pip.win && pipContent && createPortal(pipContent, pip.win.document.body)}
    </section>
  );
}
