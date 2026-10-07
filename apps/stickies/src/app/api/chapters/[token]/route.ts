import { MAX_NOTES_PER_CHAPTER } from "@/lib/config";
import { getStore } from "@/lib/server/store";
import { error, handle, readJson } from "@/lib/server/http";
import { cleanName, isToken } from "@/lib/server/validate";

type Ctx = RouteContext<"/api/chapters/[token]">;

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { token } = await ctx.params;
  const room = isToken(token) ? await getStore().getChapter(token) : null;
  if (!room) return error(404, "Chapter not found");
  return Response.json({ ...room, limit: MAX_NOTES_PER_CHAPTER });
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { token } = await ctx.params;
  const name = cleanName(((await readJson(req)) as { name?: unknown } | null)?.name);
  if (!isToken(token) || !name) return error(400, "Invalid name");
  const chapter = await getStore().renameChapter(token, name);
  return chapter ? Response.json({ chapter }) : error(404, "Chapter not found");
});
