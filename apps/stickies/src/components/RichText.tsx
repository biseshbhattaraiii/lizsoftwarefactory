"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { sanitizeNoteHtml } from "@/lib/sanitize";

/**
 * A contentEditable note body. While you're typing, incoming changes from
 * others don't replace the text under your cursor; they're applied on blur.
 */
export function RichText({
  html,
  onChange,
  autoFocus,
  editorRef,
}: {
  html: string;
  onChange(html: string): void;
  autoFocus?: boolean;
  editorRef: RefObject<HTMLDivElement | null>;
}) {
  const focused = useRef(false);

  const sync = (el: HTMLDivElement) => {
    const clean = sanitizeNoteHtml(html);
    if (el.innerHTML !== clean) el.innerHTML = clean;
  };

  useLayoutEffect(() => {
    if (editorRef.current && !focused.current) sync(editorRef.current);
  });

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus();
  }, [autoFocus, editorRef]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Note text"
      data-placeholder="Write something…"
      className="note-text absolute inset-0 overflow-y-auto px-3.5 py-3 text-[15px] leading-relaxed outline-none"
      onFocus={() => (focused.current = true)}
      onBlur={(e) => {
        focused.current = false;
        sync(e.currentTarget);
      }}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      onPaste={(e) => {
        // Paste as plain text so foreign styles and markup never enter a shared note.
        e.preventDefault();
        e.currentTarget.ownerDocument.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    />
  );
}
