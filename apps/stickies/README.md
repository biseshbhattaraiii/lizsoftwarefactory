# Stickies

Collaborative sticky notes that stay on top of your screen.

- **My notes**: personal notes, saved in your browser.
- **Chapters**: a team's shared board (up to 10 notes). Anyone with the chapter's link can view and edit; changes appear live for everyone, along with who's here and who's typing.
- **Pop out**: float one note or a whole board in an always-on-top window (Chrome/Edge, via the Document Picture-in-Picture API).
- Notes have rich text (bold, italic, underline, strikethrough, lists), six colors, pin-to-top, and a pen layer that works with mouse, touch, and stylus pressure.

## Run it

```bash
npm install
npm run dev
```

With no environment variables set, the app runs with no further setup: chapters are saved to `.data/dev-db.json`, and live updates go through a built-in dev relay (`/api/relay`). This mode is for local development only.

Inside the factory this app is served at `/apps/stickies`: `scripts/factory.mjs` builds it with `BASE_PATH=/apps/stickies`. Use `apiUrl()` from `src/lib/config.ts` for any new `fetch` or `EventSource` URL, because Next doesn't add the base path to those.

## Use Supabase

1. Create a Supabase project and apply the migration:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
2. Copy `.env.example` to `.env.local` and fill in the URL, publishable key, and secret key.
3. In the dashboard under Realtime → Settings, keep **Allow public access** on (chapters use public broadcast channels named after their secret token).

## How it works

| Piece | Where |
| --- | --- |
| Note limit, colors, size limits | `src/lib/config.ts` |
| API (all access scoped by chapter token) | `src/app/api/chapters/**` |
| Storage: Supabase or dev JSON file | `src/lib/server/store*.ts`, `supabase/migrations/` |
| Live sync: Supabase Realtime, dev relay, or cross-tab | `src/lib/sync/channel.ts`, `supabase-channel.ts` |
| Board state, optimistic updates, debounced saves | `src/lib/sync/useBoard.ts` |
| Pop-out window | `src/components/usePip.ts`, `Board.tsx` |

**Security model.** No accounts: the chapter link contains a random 22-character token, and knowing it is what grants access. The database tables have row-level security on with no policies, so the browser's publishable key can't read them; every read and write goes through the API, which checks the token. Note HTML is sanitized to plain formatting tags before it's rendered.

**Concurrent edits.** The last write wins per note. While you're typing in a note, other people's changes to that note are held back and applied when you click away, so your cursor doesn't jump. Drawings never conflict: each stroke is stored separately.

## Deploying

Push to `main`. The factory VPS notices within a minute and rebuilds and restarts only this app (see the root README, "Push to deploy").
