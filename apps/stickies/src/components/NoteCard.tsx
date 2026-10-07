"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { NOTE_COLORS, NOTE_COLOR_KEYS, PEN_COLORS } from "@/lib/config";
import type { Note, NotePatch, Stroke } from "@/lib/types";
import { DrawingLayer } from "./DrawingLayer";
import { RichText } from "./RichText";
import {
  EraseIcon,
  ListIcon,
  ListNumIcon,
  PaletteIcon,
  PenIcon,
  PinIcon,
  PopOutIcon,
  ReturnIcon,
  TrashIcon,
  TypeIcon,
  UndoIcon,
} from "./icons";

export interface NoteActions {
  onPatch(patch: NotePatch): void;
  onRemove(): void;
  onStroke(stroke: Stroke): void;
  onUndoStroke(strokeId: string): void;
  onClearStrokes(): void;
}

function ToolButton({
  label,
  onClick,
  pressed,
  danger,
  children,
}: {
  label: string;
  onClick(): void;
  pressed?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      // Keep the text selection in the editor when clicking formatting buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-7 min-w-7 place-items-center rounded-md px-1 text-[13px] transition-colors ${
        danger
          ? "bg-red-600 text-white"
          : pressed
            ? "bg-black/80 text-white"
            : "text-black/60 hover:bg-black/10 hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}

/** Two-click confirm without a dialog (dialogs would open in the main tab, not the PiP window). */
function useConfirm(action: () => void) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return {
    armed,
    trigger() {
      if (armed) action();
      setArmed(!armed);
    },
  };
}

export function NoteCard({
  note,
  actions,
  typingName,
  autoFocus,
  fill,
  onPopOut,
  onReturn,
}: {
  note: Note;
  actions: NoteActions;
  typingName?: string;
  autoFocus?: boolean;
  /** Fill the whole window (a single note popped out). */
  fill?: boolean;
  onPopOut?(): void;
  onReturn?(): void;
}) {
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [pen, setPen] = useState<string>(PEN_COLORS[0]);
  const [showColors, setShowColors] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const myStrokes = useRef<string[]>([]);
  const del = useConfirm(actions.onRemove);
  const clear = useConfirm(actions.onClearStrokes);
  const colors = NOTE_COLORS[note.color];

  const format = (cmd: string) => {
    const el = editorRef.current;
    if (!el) return;
    if (el.ownerDocument.activeElement !== el) el.focus();
    el.ownerDocument.execCommand(cmd);
  };

  const undo = () => {
    const ids = new Set(note.strokes.map((s) => s.id));
    while (myStrokes.current.length) {
      const id = myStrokes.current.pop()!;
      if (ids.has(id)) return actions.onUndoStroke(id);
    }
  };

  return (
    <article
      className={`note relative flex flex-col overflow-hidden text-[#1f1d1a] ${
        fill ? "h-full w-full" : "h-[280px] rounded-[4px] shadow-[0_1px_2px_rgb(0_0_0/.12),0_8px_20px_-8px_rgb(0_0_0/.3)]"
      }`}
      style={{ background: colors.paper }}
      aria-label="Sticky note"
    >
      <header className="flex items-center gap-0.5 px-1.5 pt-1.5 pb-1" style={{ background: colors.edge }}>
        <div className="mr-1 flex rounded-lg bg-black/5 p-0.5" role="group" aria-label="Mode">
          <ToolButton label="Type" pressed={mode === "type"} onClick={() => setMode("type")}>
            <TypeIcon />
          </ToolButton>
          <ToolButton label="Draw" pressed={mode === "draw"} onClick={() => setMode("draw")}>
            <PenIcon />
          </ToolButton>
        </div>
        <div className="flex-1" />
        <ToolButton label="Note color" pressed={showColors} onClick={() => setShowColors((v) => !v)}>
          <PaletteIcon />
        </ToolButton>
        <ToolButton
          label={note.pinned ? "Unpin from top" : "Pin to top"}
          pressed={note.pinned}
          onClick={() => actions.onPatch({ pinned: !note.pinned })}
        >
          <PinIcon />
        </ToolButton>
        {onPopOut && (
          <ToolButton label="Pop out (stays on top of other windows)" onClick={onPopOut}>
            <PopOutIcon />
          </ToolButton>
        )}
        {onReturn && (
          <ToolButton label="Back to tab" onClick={onReturn}>
            <ReturnIcon />
          </ToolButton>
        )}
        <ToolButton label={del.armed ? "Click again to delete" : "Delete note"} danger={del.armed} onClick={del.trigger}>
          <TrashIcon />
        </ToolButton>
      </header>

      <div className="flex h-8 items-center gap-0.5 border-b border-black/5 px-1.5">
        {showColors ? (
          <div className="flex items-center gap-1.5 px-1" role="group" aria-label="Note color">
            {NOTE_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                title={NOTE_COLORS[c].label}
                aria-label={NOTE_COLORS[c].label}
                aria-pressed={c === note.color}
                onClick={() => {
                  actions.onPatch({ color: c });
                  setShowColors(false);
                }}
                className={`h-5 w-5 rounded-full border border-black/20 ${c === note.color ? "ring-2 ring-black/70 ring-offset-1" : ""}`}
                style={{ background: NOTE_COLORS[c].paper }}
              />
            ))}
          </div>
        ) : mode === "type" ? (
          <>
            <ToolButton label="Bold" onClick={() => format("bold")}><b>B</b></ToolButton>
            <ToolButton label="Italic" onClick={() => format("italic")}><i className="font-serif">I</i></ToolButton>
            <ToolButton label="Underline" onClick={() => format("underline")}><u>U</u></ToolButton>
            <ToolButton label="Strikethrough" onClick={() => format("strikeThrough")}><s>S</s></ToolButton>
            <ToolButton label="Bulleted list" onClick={() => format("insertUnorderedList")}><ListIcon /></ToolButton>
            <ToolButton label="Numbered list" onClick={() => format("insertOrderedList")}><ListNumIcon /></ToolButton>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 px-1" role="group" aria-label="Pen color">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Pen ${c}`}
                  aria-pressed={c === pen}
                  onClick={() => setPen(c)}
                  className={`h-4 w-4 rounded-full ${c === pen ? "ring-2 ring-black/60 ring-offset-1" : ""}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex-1" />
            <ToolButton label="Undo my last stroke" onClick={undo}><UndoIcon /></ToolButton>
            <ToolButton
              label={clear.armed ? "Click again to clear drawing" : "Clear drawing"}
              danger={clear.armed}
              onClick={clear.trigger}
            >
              <EraseIcon />
            </ToolButton>
          </>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <RichText
          html={note.html}
          onChange={(html) => actions.onPatch({ html })}
          autoFocus={autoFocus}
          editorRef={editorRef}
        />
        <DrawingLayer
          strokes={note.strokes}
          active={mode === "draw"}
          color={pen}
          onStroke={(s) => {
            myStrokes.current.push(s.id);
            actions.onStroke(s);
          }}
        />
        {typingName && (
          <p className="pointer-events-none absolute right-2 bottom-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">
            {typingName} is typing…
          </p>
        )}
      </div>
    </article>
  );
}
