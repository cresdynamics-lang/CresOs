import type { Conversation, OnlineUser } from "./community-types";

export function isChannelConversation(c: Conversation): boolean {
  return c.type === "channel" || c.type === "project";
}

export function formatMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return "";
  }
}

export function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (label.trim()[0] ?? "?").toUpperCase();
}

export function avatarUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl?.trim()) return null;
  const p = pathOrUrl.trim();
  if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("/")) return p;
  const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  return base ? `${base}${p.startsWith("/") ? p : `/${p}`}` : p;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "online":
      return "bg-emerald-500";
    case "busy":
      return "bg-rose-500";
    case "away":
      return "bg-amber-400";
    default:
      return "bg-slate-500";
  }
}

export function peerSubtitle(conv: Conversation | null, roster: OnlineUser[], myId?: string): string {
  if (!conv) return "";
  if (isChannelConversation(conv)) {
    const n = conv.participantCount ?? conv.participants.length;
    return `${n} member${n === 1 ? "" : "s"} · project channel`;
  }
  const otherId = conv.participants.find((p) => p !== myId);
  const u = otherId ? roster.find((x) => x.id === otherId) ?? conv.otherUser : conv.otherUser;
  if (!u) return "Direct message";
  if (u.isOnline) return u.status === "online" ? "online" : u.status;
  return "offline";
}

export function CommunityChannelBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-sky-400/20 to-violet-500/15 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-sm ${className}`}
    >
      <img src="/LOGO.jpg" width={40} height={40} alt="" className="h-full w-full rounded-[10px] object-cover" />
    </div>
  );
}
