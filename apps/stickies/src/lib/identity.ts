"use client";

import { nanoid } from "nanoid";
import { useSyncExternalStore } from "react";
import type { Member } from "./types";

const KEY = "stickies:me";
const ADJECTIVES = ["Swift", "Calm", "Bright", "Bold", "Quiet", "Clever", "Sunny", "Brave"];
const ANIMALS = ["Otter", "Falcon", "Panda", "Koala", "Lynx", "Heron", "Fox", "Orca"];
const AVATAR_COLORS = ["#e76f51", "#2a9d8f", "#7c5cff", "#e9a23b", "#3a86ff", "#d6336c", "#2b9348"];

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

let cached: Member | undefined;
const listeners = new Set<() => void>();

function read(): Member {
  if (cached) return cached;
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? "null") as Member | null;
    if (m?.id && m.name && m.color) return (cached = m);
  } catch {}
  cached = { id: nanoid(12), name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, color: pick(AVATAR_COLORS) };
  write(cached);
  return cached;
}

function write(m: Member) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cached = undefined;
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current person (no accounts: a random guest name, editable, remembered in this browser). */
export function useMe(): Member | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function setMyName(name: string) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return;
  cached = { ...read(), name: trimmed };
  write(cached);
  listeners.forEach((l) => l());
}
