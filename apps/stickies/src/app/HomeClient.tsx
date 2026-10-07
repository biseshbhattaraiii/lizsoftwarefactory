"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Board } from "@/components/Board";
import { PlusIcon, UsersIcon } from "@/components/icons";
import { TopBar } from "@/components/TopBar";
import { apiUrl } from "@/lib/config";
import { useMe } from "@/lib/identity";
import { rememberChapter, useRecentChapters } from "@/lib/recent";
import { tabChannel } from "@/lib/sync/channel";
import { localPersistence } from "@/lib/sync/persistence";
import { useBoard } from "@/lib/sync/useBoard";

function NewChapter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-muted/60 px-3 text-sm font-medium hover:bg-line/50"
      >
        <PlusIcon /> New chapter
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(apiUrl("/api/chapters"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: new FormData(e.currentTarget).get("name") }),
          });
          if (!res.ok) throw new Error();
          const { chapter } = (await res.json()) as { chapter: { token: string; name: string } };
          rememberChapter(chapter.token, chapter.name);
          router.push(`/c/${chapter.token}`);
        } catch {
          setError("Couldn't create the chapter. Try again.");
          setBusy(false);
        }
      }}
    >
      <input
        name="name"
        autoFocus
        required
        maxLength={80}
        placeholder="Chapter name, e.g. Payments team"
        aria-label="New chapter name"
        className="h-9 w-64 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-ink"
      />
      <button type="submit" disabled={busy} className="h-9 rounded-lg bg-ink px-3 text-sm font-medium text-bg disabled:opacity-50">
        {busy ? "Creating…" : "Create"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-9 px-2 text-sm text-muted hover:text-ink">
        Cancel
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function HomeClient() {
  const me = useMe();
  const recent = useRecentChapters();
  const persistence = useMemo(() => localPersistence(), []);
  const board = useBoard({ room: "personal", persistence, channel: tabChannel, me });

  return (
    <>
      <TopBar />
      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <div className="rounded-xl border border-line bg-surface px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <UsersIcon className="text-muted" />
            <h2 className="text-sm font-semibold">Chapters</h2>
            <p className="text-sm text-muted max-sm:hidden">Shared boards for a team. Anyone with the link can edit.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {recent.map((c) => (
              <Link
                key={c.token}
                href={`/c/${c.token}`}
                className="inline-flex h-9 max-w-60 items-center rounded-lg border border-line bg-bg px-3 text-sm font-medium hover:border-ink"
              >
                <span className="truncate">{c.name}</span>
              </Link>
            ))}
            <NewChapter />
          </div>
        </div>
      </section>
      <Board
        board={board}
        title="My notes"
        emptyText="No notes yet. Add one and pop it out to keep it on top of your screen."
        heading={
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My notes</h1>
            <p className="text-sm text-muted">Private to this browser.</p>
          </div>
        }
      />
    </>
  );
}
