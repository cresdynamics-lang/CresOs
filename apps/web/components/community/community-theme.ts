/** CresOS community — liquid glass surfaces (see community-glass-theme). */
import { communityGlass } from "./community-glass-theme";

export const communityTheme = {
  shell:
    "flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row rounded-none md:rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl",
  sidebarHeader: communityGlass.sidebarHeader,
  sidebarBg: communityGlass.sidebarBg,
  chatHeader: communityGlass.chatHeader,
  chatBg: communityGlass.chatBg,
  listHover: communityGlass.listHover,
  listActive: communityGlass.listActive,
  outgoing: communityGlass.outgoing,
  incoming: communityGlass.incoming,
  inputBar: communityGlass.inputBar,
  accent: "#38bdf8",
  accentEmerald: "#34d399",
  border: "border-white/10",
  tabActive: communityGlass.tabActive,
  tabIdle: communityGlass.tabIdle,
  sectionHeader: communityGlass.sectionHeader,
  unread: "bg-sky-500 text-white shadow-lg shadow-sky-500/30",
  searchBg: communityGlass.searchBg
} as const;

export const directChatUi = {
  wallpaper: "chat-wallpaper-glass",
  header: communityTheme.chatHeader,
  inputBar: communityTheme.inputBar,
  accent: communityTheme.accentEmerald,
  sendBtn:
    "bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white backdrop-blur-md border border-white/10 hover:from-emerald-400 hover:to-teal-400",
  outgoing: "text-emerald-50 " + communityTheme.outgoing,
  incoming: "text-slate-100 " + communityTheme.incoming,
  outgoingShape: "rounded-2xl rounded-br-md",
  incomingShape: "rounded-2xl rounded-bl-md",
  timeMine: "text-emerald-200/80",
  timeTheir: "text-slate-400",
  replyBorder: "border-l-4 border-emerald-400/60",
  selectedRing: "ring-2 ring-sky-400/40 ring-offset-2 ring-offset-transparent",
  sheetBg: "bg-white/[0.08] backdrop-blur-xl border border-white/10",
  composerFocus: "focus:ring-sky-500/25"
} as const;

export const channelChatUi = {
  wallpaper: "",
  header: communityTheme.chatHeader,
  inputBar: communityTheme.inputBar,
  accent: "#94a3b8",
  sendBtn: "bg-white/10 text-slate-100 backdrop-blur-md border border-white/10 hover:bg-white/15",
  replyBorder: "border-l-2 border-slate-400/50",
  selectedRing: "ring-1 ring-slate-400/30",
  sheetBg: "bg-white/[0.06] backdrop-blur-xl",
  composerFocus: "focus:ring-slate-500/20"
} as const;

import type { Conversation } from "./community-types";
import { isChannelConversation } from "./community-utils";

export function chatUiFor(conv: Conversation | null) {
  return conv && isChannelConversation(conv) ? channelChatUi : directChatUi;
}
