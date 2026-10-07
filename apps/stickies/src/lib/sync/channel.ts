import { nanoid } from "nanoid";
import { apiUrl } from "@/lib/config";
import type { Member, Note, NotePatch, Stroke } from "@/lib/types";

/** Changes broadcast to everyone else on the board. Persisting is done separately via the API. */
export type SyncEvent =
  | { t: "upsert"; note: Note }
  | { t: "patch"; id: string; patch: NotePatch; updatedAt: string }
  | { t: "remove"; id: string }
  | { t: "stroke"; id: string; stroke: Stroke }
  | { t: "unstroke"; id: string; strokeId: string }
  | { t: "clear"; id: string }
  | { t: "title"; name: string };

export type ConnStatus = "connecting" | "live" | "offline";

export interface ChannelHandlers {
  onEvent(ev: SyncEvent, from: Member): void;
  onMembers(members: Member[]): void;
  onStatus(status: ConnStatus): void;
  /** Fired after a reconnect, when events may have been missed. */
  onResync(): void;
}

export interface SyncChannel {
  send(ev: SyncEvent): void;
  setMe(me: Member): void;
  close(): void;
}

export type ChannelFactory = (room: string, me: Member, handlers: ChannelHandlers) => SyncChannel;

/** One entry per person, even if they have the board open in several tabs. */
export function uniqueMembers(members: Member[]): Member[] {
  return [...new Map(members.map((m) => [m.id, m])).values()];
}

// --- Presence + events over a plain fan-out transport (dev relay, BroadcastChannel) ---

type Wire = { conn: string; from: Member } & (
  | { k: "ev"; ev: SyncEvent }
  | { k: "here"; ask?: boolean }
  | { k: "bye" }
);

interface Transport {
  post(msg: Wire): void;
  close(): void;
}

interface TransportCallbacks {
  onMessage(msg: Wire): void;
  onOpen(): void;
  onDown(): void;
}

const HEARTBEAT_MS = 5_000;
const STALE_MS = 16_000;

function overTransport(
  me: Member,
  h: ChannelHandlers,
  open: (cb: TransportCallbacks) => Transport,
): SyncChannel {
  const conn = nanoid(10);
  let self = me;
  let connectedBefore = false;
  const peers = new Map<string, { member: Member; seen: number }>();

  const emitMembers = () =>
    h.onMembers(uniqueMembers([self, ...[...peers.values()].map((p) => p.member)]));
  const here = (ask = false): Wire => ({ conn, from: self, k: "here", ask });

  const transport: Transport = open({
    onMessage(msg) {
      if (msg.conn === conn) return;
      if (msg.k === "bye") {
        peers.delete(msg.conn);
        emitMembers();
        return;
      }
      const prev = peers.get(msg.conn);
      peers.set(msg.conn, { member: msg.from, seen: Date.now() });
      if (!prev || prev.member.name !== msg.from.name) emitMembers();
      if (msg.k === "here" && msg.ask) transport.post(here());
      if (msg.k === "ev") h.onEvent(msg.ev, msg.from);
    },
    onOpen() {
      h.onStatus("live");
      transport.post(here(true));
      if (connectedBefore) h.onResync();
      connectedBefore = true;
    },
    onDown() {
      h.onStatus("connecting");
    },
  });

  const timer = setInterval(() => {
    transport.post(here());
    const cutoff = Date.now() - STALE_MS;
    let changed = false;
    for (const [id, p] of peers) {
      if (p.seen < cutoff) changed = peers.delete(id);
    }
    if (changed) emitMembers();
  }, HEARTBEAT_MS);
  emitMembers();

  return {
    send: (ev) => transport.post({ conn, from: self, k: "ev", ev }),
    setMe(m) {
      self = m;
      transport.post(here());
      emitMembers();
    },
    close() {
      clearInterval(timer);
      transport.post({ conn, from: self, k: "bye" });
      transport.close();
    },
  };
}

/** Dev-mode realtime via the in-process SSE relay at /api/relay. */
export const relayChannel: ChannelFactory = (room, me, h) =>
  overTransport(me, h, ({ onMessage, onOpen, onDown }) => {
    const url = apiUrl(`/api/relay/${encodeURIComponent(room)}`);
    const es = new EventSource(url);
    es.onopen = onOpen;
    es.onerror = onDown;
    es.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data) as Wire);
      } catch {}
    };
    // Post one message at a time so they arrive in the order they were sent.
    let queue = Promise.resolve();
    return {
      post(msg) {
        const body = JSON.stringify(msg);
        const keepalive = msg.k === "bye";
        queue = queue
          .then(() => fetch(url, { method: "POST", body, keepalive }))
          .then(
            () => {},
            () => {},
          );
      },
      close: () => es.close(),
    };
  });

/** Keeps several tabs of the same browser in sync (used for personal notes). */
export const tabChannel: ChannelFactory = (room, me, h) =>
  overTransport(me, h, ({ onMessage, onOpen }) => {
    const bc = new BroadcastChannel(`stickies:${room}`);
    bc.onmessage = (e) => onMessage(e.data as Wire);
    queueMicrotask(onOpen);
    return {
      post: (msg) => bc.postMessage(msg),
      close: () => bc.close(),
    };
  });
