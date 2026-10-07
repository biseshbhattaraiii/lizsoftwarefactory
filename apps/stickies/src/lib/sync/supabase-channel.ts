import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import type { Member } from "@/lib/types";
import { uniqueMembers, type ChannelFactory, type SyncEvent } from "./channel";

let client: Promise<SupabaseClient> | undefined;

function getClient() {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      // worker: keep the socket's heartbeat alive while the tab is in the
      // background, which is exactly when a popped-out board is in use.
      { auth: { persistSession: false }, realtime: { worker: true } },
    ),
  );
  return client;
}

/**
 * Supabase Realtime broadcast + presence. The topic contains the chapter's
 * secret token, so only people with the link can join it.
 */
export const supabaseChannel: ChannelFactory = (room, me, h) => {
  const conn = nanoid(10);
  let self = me;
  let ch: RealtimeChannel | null = null;
  let closed = false;
  let connectedBefore = false;
  const queued: SyncEvent[] = [];

  const send = (ev: SyncEvent) =>
    void ch?.send({ type: "broadcast", event: "ev", payload: { ev, from: self } });

  void getClient().then((sb) => {
    if (closed) return;
    ch = sb.channel(`chapter:${room}`, {
      config: { broadcast: { self: false }, presence: { key: conn } },
    });
    ch.on("broadcast", { event: "ev" }, ({ payload }) => {
      const { ev, from } = payload as { ev: SyncEvent; from: Member };
      h.onEvent(ev, from);
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch!.presenceState<{ member: Member }>();
      h.onMembers(uniqueMembers(Object.values(state).flatMap((ps) => ps.map((p) => p.member))));
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        h.onStatus("live");
        void ch!.track({ member: self });
        queued.splice(0).forEach(send);
        if (connectedBefore) h.onResync();
        connectedBefore = true;
      } else if (status === "CLOSED") {
        h.onStatus(closed ? "offline" : "connecting");
      } else {
        h.onStatus("connecting");
      }
    });
  });

  return {
    send(ev) {
      if (connectedBefore) send(ev);
      else queued.push(ev);
    },
    setMe(m) {
      self = m;
      if (connectedBefore) void ch?.track({ member: m });
    },
    close() {
      closed = true;
      if (ch) void getClient().then((sb) => sb.removeChannel(ch!));
    },
  };
};
