"use client";

import { useSyncExternalStore } from "react";

/** Chapters this browser has opened, so people can get back to them without the link. */
export interface RecentChapter {
  token: string;
  name: string;
  visitedAt: string;
}

const KEY = "stickies:chapters";
const EMPTY: RecentChapter[] = [];
let raw: string | null = null;
let parsed: RecentChapter[] = EMPTY;
const listeners = new Set<() => void>();

function read(): RecentChapter[] {
  let next: string | null = null;
  try {
    next = localStorage.getItem(KEY);
  } catch {}
  if (next !== raw) {
    raw = next;
    try {
      parsed = next ? (JSON.parse(next) as RecentChapter[]) : EMPTY;
    } catch {
      parsed = EMPTY;
    }
  }
  return parsed;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useRecentChapters(): RecentChapter[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function rememberChapter(token: string, name: string) {
  const list = [
    { token, name, visitedAt: new Date().toISOString() },
    ...read().filter((c) => c.token !== token),
  ].slice(0, 12);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  listeners.forEach((l) => l());
}

export function forgetChapter(token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(read().filter((c) => c.token !== token)));
  } catch {}
  listeners.forEach((l) => l());
}
