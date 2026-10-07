import type { NoteColor } from "./config";

/** A pen point: x and y are divided by the drawing width so strokes scale with the note; p is pressure 0..1. */
export type Point = [x: number, y: number, p: number];

export interface Stroke {
  id: string;
  color: string;
  width: number;
  points: Point[];
}

export interface Note {
  id: string;
  html: string;
  color: NoteColor;
  pinned: boolean;
  strokes: Stroke[];
  createdAt: string;
  updatedAt: string;
}

export type NotePatch = Partial<Pick<Note, "html" | "color" | "pinned">>;

export interface Chapter {
  token: string;
  name: string;
  createdAt: string;
}

/** A person looking at a board. `id` is stable per browser; each tab also gets its own connection id. */
export interface Member {
  id: string;
  name: string;
  color: string;
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt),
  );
}
