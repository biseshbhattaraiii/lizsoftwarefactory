import { getStore } from "@/lib/server/store";
import { handle, readJson } from "@/lib/server/http";
import { cleanName } from "@/lib/server/validate";

export const POST = handle(async (req: Request) => {
  const body = (await readJson(req)) as { name?: unknown } | null;
  const chapter = await getStore().createChapter(cleanName(body?.name) ?? "Untitled chapter");
  return Response.json({ chapter }, { status: 201 });
});
