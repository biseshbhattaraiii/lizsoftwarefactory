import type { ConnStatus } from "@/lib/sync/channel";
import type { Member } from "@/lib/types";

const STATUS: Record<ConnStatus, { label: string; color: string }> = {
  live: { label: "Live", color: "#22c55e" },
  connecting: { label: "Reconnecting…", color: "#f59e0b" },
  offline: { label: "Offline", color: "#9ca3af" },
};

export function ConnBadge({ status }: { status: ConnStatus }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function Members({ members }: { members: Member[] }) {
  if (!members.length) return null;
  const shown = members.slice(0, 6);
  return (
    <div className="flex items-center" aria-label={`${members.length} here now: ${members.map((m) => m.name).join(", ")}`}>
      {shown.map((m) => (
        <span
          key={m.id}
          title={m.name}
          className="-ml-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-bg text-[11px] font-semibold text-white first:ml-0"
          style={{ background: m.color }}
        >
          {m.name[0]}
        </span>
      ))}
      {members.length > shown.length && (
        <span className="ml-1.5 text-xs text-muted">+{members.length - shown.length}</span>
      )}
    </div>
  );
}
