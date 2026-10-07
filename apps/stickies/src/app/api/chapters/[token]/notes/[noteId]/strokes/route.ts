import { MAX_STROKES_PER_NOTE } from "@/lib/config";
import { getStore } from "@/lib/server/store";
import { error, handle, readJson } from "@/lib/server/http";
import { isId, isToken, parseStroke } from "@/lib/server/validate";

type Ctx = RouteContext<"/api/chapters/[token]/notes/[noteId]/strokes">;

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { token, noteId } = await ctx.params;
  const stroke = parseStroke(await readJson(req));
  if (!isToken(token) || !isId(noteId) || !stroke) return error(400, "Invalid stroke");
  const ok = await getStore().addStroke(token, noteId, stroke, MAX_STROKES_PER_NOTE);
  return ok ? new Response(null, { status: 204 }) : error(409, "Couldn't add to that drawing.");
});

/** DELETE ?id=<strokeId> removes one stroke (undo); without it, clears the drawing. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { token, noteId } = await ctx.params;
  const strokeId = new URL(req.url).searchParams.get("id");
  if (!isToken(token) || !isId(noteId) || (strokeId !== null && !isId(strokeId))) {
    return error(400, "Invalid request");
  }
  const store = getStore();
  const ok = strokeId
    ? await store.removeStroke(token, noteId, strokeId)
    : await store.clearStrokes(token, noteId);
  return ok ? new Response(null, { status: 204 }) : error(404, "Note not found");
});
