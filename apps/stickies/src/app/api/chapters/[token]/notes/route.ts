import { MAX_NOTES_PER_CHAPTER } from "@/lib/config";
import { getStore } from "@/lib/server/store";
import { error, handle, readJson } from "@/lib/server/http";
import { isColor, isId, isToken } from "@/lib/server/validate";

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/chapters/[token]/notes">) => {
  const { token } = await ctx.params;
  const body = (await readJson(req)) as { id?: unknown; color?: unknown } | null;
  if (!isToken(token) || !isId(body?.id) || !isColor(body?.color)) return error(400, "Invalid note");

  const res = await getStore().createNote(token, body.id, body.color, MAX_NOTES_PER_CHAPTER);
  if ("note" in res) return Response.json({ note: res.note }, { status: 201 });
  if (res.error === "limit") {
    return error(409, `This chapter already has ${MAX_NOTES_PER_CHAPTER} notes.`);
  }
  return error(res.error === "exists" ? 409 : 404, res.error === "exists" ? "Note exists" : "Chapter not found");
});
