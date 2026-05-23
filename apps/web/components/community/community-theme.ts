/** CresOS community chrome — dark chat surfaces with brand accents */
export const communityTheme = {
  shell: "border border-slate-700/60 bg-gradient-to-br from-slate-950 via-[#0d1219] to-slate-950 shadow-xl shadow-black/30",
  sidebarHeader: "bg-gradient-to-r from-violet-950/80 via-slate-900/95 to-sky-950/50 border-b border-slate-700/50",
  sidebarBg: "bg-slate-950/95 backdrop-blur-sm",
  chatHeader: "bg-slate-900/95 backdrop-blur-md border-b border-slate-700/50",
  chatBg: "bg-[#0a0f14]",
  listHover: "hover:bg-slate-800/60",
  listActive: "bg-gradient-to-r from-violet-600/20 to-sky-600/10 border-l-2 border-l-violet-500",
  outgoing: "bg-gradient-to-br from-emerald-700/90 to-emerald-800/90",
  incoming: "bg-slate-800/90",
  inputBar: "bg-slate-900/95 border-t border-slate-700/50",
  accent: "#8b5cf6",
  accentEmerald: "#10b981",
  border: "border-slate-700/50",
  tabActive: "bg-violet-600/25 text-violet-200 border-violet-500/50",
  tabIdle: "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent",
  sectionHeader: "bg-slate-900/50 hover:bg-slate-800/70",
  unread: "bg-violet-600 text-white",
  searchBg: "bg-slate-900/80 border border-slate-700/50 focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20"
} as const;

export const directChatUi = {
  wallpaper: "chat-wallpaper-wa",
  header: communityTheme.chatHeader,
  inputBar: communityTheme.inputBar,
  accent: communityTheme.accentEmerald,
  sendBtn: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500",
  outgoing: "text-emerald-50 " + communityTheme.outgoing,
  incoming: "text-slate-100 " + communityTheme.incoming,
  outgoingShape: "rounded-2xl rounded-br-md",
  incomingShape: "rounded-2xl rounded-bl-md",
  timeMine: "text-emerald-200/80",
  timeTheir: "text-slate-400",
  replyBorder: "border-l-4 border-emerald-500",
  selectedRing: "ring-2 ring-violet-500/50 ring-offset-2 ring-offset-[#0a0f14]",
  sheetBg: "bg-slate-900/95",
  composerFocus: "focus:ring-violet-500/30"
} as const;

export const channelChatUi = {
  wallpaper: "",
  header: communityTheme.chatHeader,
  inputBar: communityTheme.inputBar,
  accent: "#94a3b8",
  sendBtn: "bg-slate-700 text-slate-100 hover:bg-slate-600",
  replyBorder: "border-l-2 border-slate-500",
  selectedRing: "ring-1 ring-slate-500/40",
  sheetBg: "bg-slate-900/90",
  composerFocus: "focus:ring-slate-500/25"
} as const;

import type { Conversation } from "./community-types";
import { isChannelConversation } from "./community-utils";

export function chatUiFor(conv: Conversation | null) {
  return conv && isChannelConversation(conv) ? channelChatUi : directChatUi;
}
