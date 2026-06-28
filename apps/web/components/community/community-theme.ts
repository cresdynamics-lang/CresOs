/** CresOS community — liquid glass surfaces (see community-glass-theme). */
import { communityGlass } from "./community-glass-theme";

export const communityTheme = {
  shell: `flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row rounded-none md:rounded-2xl ${communityGlass.shell}`,
  sidebarHeader: communityGlass.sidebarHeader,
  sidebarBg: communityGlass.sidebarBg,
  chatHeader: communityGlass.chatHeader,
  chatBg: communityGlass.chatBg,
  listHover: communityGlass.listHover,
  listActive: communityGlass.listActive,
  listBorder: communityGlass.listBorder,
  outgoing: communityGlass.outgoing,
  incoming: communityGlass.incoming,
  inputBar: communityGlass.inputBar,
  accent: "#7dd3fc",
  accentEmerald: "#6ee7b7",
  border: "border-white/[0.08]",
  tabActive: communityGlass.tabActive,
  tabIdle: communityGlass.tabIdle,
  sectionHeader: communityGlass.sectionHeader,
  unread: "bg-sky-400/90 text-white shadow-lg shadow-sky-500/25 backdrop-blur-sm",
  searchBg: communityGlass.searchBg,
  iconBtn: communityGlass.iconBtn,
  surface: communityGlass.surface,
  surfaceDeep: communityGlass.surfaceDeep,
  composer: communityGlass.composer,
  dayPill: communityGlass.dayPill,
  avatar: communityGlass.avatar,
  modal: communityGlass.modal,
  menuItem: communityGlass.menuItem
} as const;

export const directChatUi = {
  wallpaper: "chat-wallpaper-glass",
  header: communityTheme.chatHeader,
  inputBar: communityTheme.inputBar,
  accent: communityTheme.accentEmerald,
  sendBtn:
    "bg-gradient-to-r from-emerald-400/70 to-teal-400/70 text-white backdrop-blur-lg border border-white/15 hover:from-emerald-300/80 hover:to-teal-300/80 shadow-[0_4px_20px_rgba(16,185,129,0.2)]",
  outgoing: "text-emerald-50 " + communityTheme.outgoing,
  incoming: "text-slate-100 " + communityTheme.incoming,
  outgoingShape: "rounded-2xl rounded-br-md",
  incomingShape: "rounded-2xl rounded-bl-md",
  timeMine: "text-emerald-200/75",
  timeTheir: "text-slate-400",
  replyBorder: "border-l-4 border-emerald-300/50",
  selectedRing: "ring-2 ring-sky-300/35 ring-offset-2 ring-offset-transparent",
  sheetBg: "bg-white/[0.06] backdrop-blur-2xl border border-white/10",
  composerFocus: "focus:ring-sky-400/20"
} as const;

export const channelChatUi = {
  wallpaper: "",
  header: communityTheme.chatHeader,
  inputBar: communityTheme.inputBar,
  accent: "#94a3b8",
  sendBtn:
    "bg-white/10 text-slate-100 backdrop-blur-lg border border-white/12 hover:bg-white/15",
  replyBorder: "border-l-2 border-slate-400/40",
  selectedRing: "ring-1 ring-slate-400/25",
  sheetBg: "bg-white/[0.05] backdrop-blur-2xl border border-white/10",
  composerFocus: "focus:ring-slate-400/15"
} as const;

import type { Conversation } from "./community-types";
import { isChannelConversation } from "./community-utils";

export function chatUiFor(conv: Conversation | null) {
  return conv && isChannelConversation(conv) ? channelChatUi : directChatUi;
}
