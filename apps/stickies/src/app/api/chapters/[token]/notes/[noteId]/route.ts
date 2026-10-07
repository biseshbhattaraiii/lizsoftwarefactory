import { getStore } from "@/lib/server/store";
import { error, handle, readJson } from "@/lib/server/http";
import { isId, isToken, parsePatch } from "@/lib/server/validate";

type Ctx = RouteContext<"/api/chapters/[token]/notes/[noteId]">;

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { token, noteId } = await ctx.params;
  const patch = parsePatch(await readJson(req));
  if (!isToken(token) || !isId(noteId) || !patch) return error(400, "Invalid update");
  const note = await getStore().updateNote(token, noteId, patch);
  return note ? Response.json({ note }) : error(404, "Note not found");
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { token, noteId } = await ctx.params;
  if (!isToken(token) || !isId(noteId)) return error(400, "Invalid note");
  await getStore().deleteNote(token, noteId);
  return new Response(null, { status: 204 });
});
