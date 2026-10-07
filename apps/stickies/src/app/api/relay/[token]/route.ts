import { supabaseConfigured } from "@/lib/server/store";
import { error } from "@/lib/server/http";

/**
 * Development realtime relay (used only when Supabase isn't configured):
 * GET subscribes to a room over Server-Sent Events, POST fans a message out
 * to every subscriber. In-memory and single-process, so not for production.
 */
type Subscriber = (data: string) => void;
const g = globalThis as unknown as { __stickiesRelay?: Map<string, Set<Subscriber>> };
const rooms = (g.__stickiesRelay ??= new Map());

type Ctx = RouteContext<"/api/relay/[token]">;

export async function GET(req: Request, ctx: Ctx) {
  if (supabaseConfigured()) return error(404, "Not found");
  const { token } = await ctx.params;
  const room = rooms.get(token) ?? new Set<Subscriber>();
  rooms.set(token, room);

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const sub: Subscriber = (data) => send(`data: ${data}\n\n`);
      const ping = setInterval(() => send(": ping\n\n"), 15_000);
      cleanup = () => {
        clearInterval(ping);
        room.delete(sub);
        if (!room.size) rooms.delete(token);
      };
      room.add(sub);
      send(": connected\n\n");
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: Request, ctx: Ctx) {
  if (supabaseConfigured()) return error(404, "Not found");
  const { token } = await ctx.params;
  const text = await req.text();
  if (text.length > 200_000) return error(413, "Message too large");
  let line: string;
  try {
    // Re-serialize so the message has no raw newlines and fits on one SSE data line.
    line = JSON.stringify(JSON.parse(text));
  } catch {
    return error(400, "Invalid message");
  }
  for (const sub of rooms.get(token) ?? []) sub(line);
  return new Response(null, { status: 204 });
}
