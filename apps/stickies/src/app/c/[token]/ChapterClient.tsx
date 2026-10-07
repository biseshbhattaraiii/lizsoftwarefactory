"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/Board";
import { CheckIcon, LinkIcon } from "@/components/icons";
import { ConnBadge, Members } from "@/components/Members";
import { TopBar } from "@/components/TopBar";
import { SUPABASE_REALTIME_ENABLED } from "@/lib/config";
import { useMe } from "@/lib/identity";
import { forgetChapter, rememberChapter } from "@/lib/recent";
import { relayChannel } from "@/lib/sync/channel";
import { apiPersistence } from "@/lib/sync/persistence";
import { supabaseChannel } from "@/lib/sync/supabase-channel";
import { useBoard } from "@/lib/sync/useBoard";

const channel = SUPABASE_REALTIME_ENABLED ? supabaseChannel : relayChannel;

function ChapterName({ name, onRename }: { name: string; onRename(name: string): void }) {
  const commit = (value: string) => {
    const next = value.trim().replace(/\s+/g, " ").slice(0, 80);
    if (next && next !== name) onRename(next);
  };
  return (
    <input
      // Remount when someone else renames the chapter so the new name shows.
      key={name}
      defaultValue={name}
      maxLength={80}
      aria-label="Chapter name"
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="-ml-2 w-full rounded-lg bg-transparent px-2 py-0.5 text-2xl font-semibold tracking-tight outline-none hover:bg-line/40 focus:bg-surface"
    />
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted hover:text-ink"
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
      {copied ? "Link copied" : "Copy invite link"}
    </button>
  );
}

export function ChapterClient({ token }: { token: string }) {
  const me = useMe();
  const persistence = useMemo(() => apiPersistence(token), [token]);
  const board = useBoard({ room: token, persistence, channel, me });

  useEffect(() => {
    if (board.title) rememberChapter(token, board.title);
    if (board.state === "missing") forgetChapter(token);
  }, [token, board.title, board.state]);

  if (board.state === "missing") {
    return (
      <>
        <TopBar />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-semibold">Chapter not found</h1>
          <p className="mt-2 text-muted">The link may be mistyped, or the chapter was removed.</p>
          <Link href="/" className="mt-6 inline-block font-medium underline underline-offset-4">
            Go to my notes
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <Board
        board={board}
        title={board.title ?? "Chapter"}
        emptyText="This chapter has no notes yet. Everything you add here is shared live with everyone who has the link."
        heading={
          <div className="min-w-0">
            {board.title !== null ? (
              <ChapterName name={board.title} onRename={board.rename} />
            ) : (
              <div className="h-9" />
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              <ConnBadge status={board.conn} />
              <Members members={board.members} />
              <CopyLink />
            </div>
          </div>
        }
      />
    </>
  );
}
