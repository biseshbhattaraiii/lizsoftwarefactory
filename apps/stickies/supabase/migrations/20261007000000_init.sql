-- Stickies: chapters (teams) share a board of sticky notes via a secret link.
-- RLS is enabled with no policies: browsers never touch these tables directly.
-- The Next.js API (secret key) is the only reader/writer, scoped by chapter token.

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) between 16 and 64),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.notes (
  id text primary key check (char_length(id) between 6 and 40),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  html text not null default '' check (char_length(html) <= 50000),
  color text not null default 'yellow'
    check (color in ('yellow', 'pink', 'blue', 'green', 'orange', 'purple')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_chapter_id_idx on public.notes (chapter_id);

create table public.note_strokes (
  id text primary key check (char_length(id) between 6 and 40),
  note_id text not null references public.notes (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index note_strokes_note_id_idx on public.note_strokes (note_id, created_at);

alter table public.chapters enable row level security;
alter table public.notes enable row level security;
alter table public.note_strokes enable row level security;
revoke all on public.chapters, public.notes, public.note_strokes from anon, authenticated;

-- Creates a note only if the chapter is under its note limit. Locks the
-- chapter row so two people adding a note at once can't exceed the limit.
create function public.create_note(p_token text, p_id text, p_color text, p_max int)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_chapter uuid;
  v_note public.notes;
begin
  select id into v_chapter from public.chapters where token = p_token for update;
  if v_chapter is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if (select count(*) from public.notes where chapter_id = v_chapter) >= p_max then
    return jsonb_build_object('status', 'limit');
  end if;

  insert into public.notes (id, chapter_id, color)
  values (p_id, v_chapter, p_color)
  on conflict (id) do nothing
  returning * into v_note;

  if v_note.id is null then
    return jsonb_build_object('status', 'exists');
  end if;
  return jsonb_build_object('status', 'ok', 'note', to_jsonb(v_note));
end;
$$;

revoke execute on function public.create_note(text, text, text, int) from public, anon, authenticated;
grant execute on function public.create_note(text, text, text, int) to service_role;
