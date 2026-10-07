"use client";

import Link from "next/link";
import { useState } from "react";
import { setMyName, useMe } from "@/lib/identity";
import { PenIcon } from "./icons";

function NameEditor() {
  const me = useMe();
  const [editing, setEditing] = useState(false);
  if (!me) return null;
  return editing ? (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMyName(new FormData(e.currentTarget).get("name") as string);
        setEditing(false);
      }}
    >
      <input
        name="name"
        defaultValue={me.name}
        autoFocus
        maxLength={40}
        aria-label="Your name"
        onBlur={(e) => {
          setMyName(e.currentTarget.value);
          setEditing(false);
        }}
        className="h-8 w-40 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-ink"
      />
    </form>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Change the name others see"
      className="group flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-line/50"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: me.color }}>
        {me.name[0]}
      </span>
      <span className="max-sm:hidden">{me.name}</span>
      <PenIcon className="h-3 w-3 text-muted opacity-0 group-hover:opacity-100" />
    </button>
  );
}

export function TopBar() {
  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-5 w-5 rotate-[-6deg] rounded-[3px] bg-[#ffe066] shadow-sm" aria-hidden="true" />
          Stickies
        </Link>
        <div className="flex-1" />
        <NameEditor />
      </div>
    </header>
  );
}
