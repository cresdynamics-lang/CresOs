"use client";

import { memo, useCallback, useEffect, useState } from "react";
import type { Conversation, OnlineUser, SidebarSection } from "./community-types";
import { communityTheme } from "./community-theme";
import {
  avatarUrl,
  CommunityChannelBadge,
  formatMessageTime,
  getStatusColor,
  initialsFromLabel
} from "./community-utils";

const SECTION_META: Record<
  SidebarSection,
  { label: string; short: string; icon: string }
> = {
  chats: { label: "Chats", short: "Chats", icon: "💬" },
  channels: { label: "Channels", short: "Chan", icon: "📢" },
  people: { label: "People", short: "Team", icon: "👥" }
};

function useDebouncedCallback<T extends string>(
  value: T,
  onChange: (v: T) => void,
  ms = 200
): [T, (v: T) => void] {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  useEffect(() => {
    const t = window.setTimeout(() => onChange(local), ms);
    return () => window.clearTimeout(t);
  }, [local, onChange, ms]);
  return [local, setLocal];
}

const ChatRow = memo(function ChatRow({
  conversation: c,
  selected,
  myId,
  onSelect
}: {
  conversation: Conversation;
  selected: boolean;
  myId?: string;
  onSelect: (c: Conversation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      className={`flex w-full items-center gap-3 border-b border-slate-800/80 px-3 py-2.5 text-left transition-colors [content-visibility:auto] ${communityTheme.listHover} ${
        selected ? communityTheme.listActive : ""
      }`}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/40 to-sky-600/30 text-lg font-semibold text-white shadow-inner">
        {initialsFromLabel(c.name)}
        {c.otherUser?.isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-slate-100">{c.name}</span>
          <span className="shrink-0 text-[11px] text-slate-500">
            {formatMessageTime(c.lastMessage.timestamp)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-slate-400">
            {c.lastMessage.senderId === myId ? "You: " : ""}
            {c.lastMessage.content}
          </p>
          {c.unreadCount > 0 && (
            <span
              className={`flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${communityTheme.unread}`}
            >
              {c.unreadCount > 99 ? "99+" : c.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});

const ChannelRow = memo(function ChannelRow({
  conversation: c,
  selected,
  myId,
  onSelect
}: {
  conversation: Conversation;
  selected: boolean;
  myId?: string;
  onSelect: (c: Conversation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      className={`flex w-full items-center gap-3 border-b border-slate-800/80 px-3 py-2.5 text-left transition-colors [content-visibility:auto] ${communityTheme.listHover} ${
        selected ? communityTheme.listActive : ""
      }`}
    >
      <CommunityChannelBadge className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-slate-100">{c.name}</span>
          <span className="shrink-0 text-[11px] text-slate-500">
            {formatMessageTime(c.lastMessage.timestamp)}
          </span>
        </div>
        <p className="truncate text-xs text-slate-500">
          {c.linkedProjectName ? `Project: ${c.linkedProjectName}` : "Channel"}
          {c.channelTopics ? ` · ${c.channelTopics}` : ""}
        </p>
        <p className="truncate text-sm text-slate-400">
          {c.lastMessage.senderId === myId ? "You: " : ""}
          {c.lastMessage.content}
        </p>
      </div>
    </button>
  );
});

const PersonRow = memo(function PersonRow({
  user,
  onMessage,
  onVoice,
  onVideo
}: {
  user: OnlineUser;
  onMessage: (u: OnlineUser) => void;
  onVoice: (u: OnlineUser) => void;
  onVideo: (u: OnlineUser) => void;
}) {
  const av = avatarUrl(user.avatar);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void onMessage(user)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void onMessage(user);
        }
      }}
      className={`flex cursor-pointer items-center gap-3 border-b border-slate-800/80 px-3 py-2.5 outline-none [content-visibility:auto] ${communityTheme.listHover} focus-visible:ring-2 focus-visible:ring-violet-500/50`}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 text-lg font-medium text-white">
        {av ? (
          <img src={av} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsFromLabel(user.name)
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${getStatusColor(user.isOnline ? user.status : "offline")}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-100">{user.name}</div>
        {user.roles && user.roles.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <span
                key={`${user.id}-${r.key}`}
                className="rounded-md bg-violet-950/60 px-1.5 py-0 text-[10px] text-violet-200/90"
              >
                {r.name}
              </span>
            ))}
          </div>
        )}
        <div
          className={`truncate text-xs ${user.isOnline ? "text-emerald-400" : "text-slate-500"}`}
        >
          {user.isOnline
            ? `${user.status === "online" ? "Online" : user.status} — tap to message`
            : "Offline — tap to open chat"}
        </div>
      </div>
      <div
        className="flex shrink-0 gap-0.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => void onMessage(user)}
          className="rounded-full p-2 text-violet-400 hover:bg-slate-800"
          title="Open chat"
          aria-label={`Message ${user.name}`}
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => void onVoice(user)}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          title={user.isOnline ? "Voice call" : "Call (they must have Community open)"}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => void onVideo(user)}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          title={user.isOnline ? "Video call" : "Video call (they must have Community open)"}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
});

export type CommunitySidebarProps = {
  visible: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  expandedSections: Record<SidebarSection, boolean>;
  onToggleSection: (s: SidebarSection) => void;
  activeSection: SidebarSection;
  onFocusSection: (s: SidebarSection) => void;
  filteredConversations: Conversation[];
  filteredChannels: Conversation[];
  filteredPeople: OnlineUser[];
  conversationsTotal: number;
  channelsLoading: boolean;
  channelToast: string | null;
  onlineUsers: OnlineUser[];
  selectedConversationId: string | null;
  myId?: string;
  onSelectConversation: (c: Conversation) => void;
  canCreateChannel?: boolean;
  onOpenNewChannel: () => void;
  onStartNewChat: () => void;
  onMessageUser: (u: OnlineUser) => void;
  onVoiceCall: (u: OnlineUser) => void;
  onVideoCall: (u: OnlineUser) => void;
  chatUnread?: number;
  channelUnread?: number;
};

export function CommunitySidebar({
  visible,
  collapsed,
  onToggleCollapsed,
  searchQuery,
  onSearchChange,
  expandedSections,
  onToggleSection,
  activeSection,
  onFocusSection,
  filteredConversations,
  filteredChannels,
  filteredPeople,
  conversationsTotal,
  channelsLoading,
  channelToast,
  onlineUsers,
  selectedConversationId,
  myId,
  onSelectConversation,
  canCreateChannel = false,
  onOpenNewChannel,
  onStartNewChat,
  onMessageUser,
  onVoiceCall,
  onVideoCall,
  chatUnread = 0,
  channelUnread = 0
}: CommunitySidebarProps) {
  const [localSearch, setLocalSearch] = useDebouncedCallback(searchQuery, onSearchChange);

  const renderSectionHeader = useCallback(
    (section: SidebarSection, count: number, badge?: number) => {
      const meta = SECTION_META[section];
      const open = expandedSections[section];
      const active = activeSection === section;
      if (collapsed) {
        return (
          <button
            type="button"
            title={meta.label}
            onClick={() => {
              onFocusSection(section);
              if (!open) onToggleSection(section);
            }}
            className={`mx-1 flex w-[calc(100%-0.5rem)] items-center justify-center rounded-xl py-2.5 text-lg ${
              active ? "bg-violet-600/30" : "hover:bg-slate-800/70"
            }`}
          >
            {meta.icon}
          </button>
        );
      }
      return (
        <div
          className={`flex w-full items-stretch border-l-2 ${
            active ? "border-l-violet-500" : "border-l-transparent"
          }`}
        >
          <button
            type="button"
            onClick={() => onToggleSection(section)}
            className={`shrink-0 px-2 py-2.5 text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200 ${communityTheme.sectionHeader}`}
            aria-expanded={open}
            aria-label={open ? `Collapse ${meta.label}` : `Expand ${meta.label}`}
          >
            <svg
              className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onFocusSection(section)}
            className={`flex min-w-0 flex-1 items-center gap-2 px-1 py-2.5 text-left ${communityTheme.sectionHeader}`}
          >
            <span className="text-base leading-none" aria-hidden>
              {meta.icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">
              {meta.label}
            </span>
            <span className="text-xs text-slate-500">{count}</span>
            {badge !== undefined && badge > 0 && (
              <span
                className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${communityTheme.unread}`}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        </div>
      );
    },
    [activeSection, collapsed, expandedSections, onFocusSection, onToggleSection]
  );

  if (!visible) return null;

  const onlineCount = onlineUsers.filter((u) => u.isOnline).length;

  return (
    <div
      className={`flex min-h-0 w-full shrink-0 flex-col border-b transition-[width] duration-200 ease-out md:border-b-0 md:border-r ${communityTheme.sidebarBg} ${communityTheme.border} ${
        collapsed ? "md:max-w-[4.25rem]" : "md:max-w-[min(100%,22rem)] md:w-[min(100%,22rem)]"
      }`}
    >
      <div className={`flex items-center gap-2 px-2 py-3 sm:px-3 ${communityTheme.sidebarHeader}`}>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
          title="Back"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight text-white">
              <span className="bg-gradient-to-r from-violet-300 via-white to-sky-300 bg-clip-text text-transparent">
                Community
              </span>
            </h1>
            <p className="truncate text-xs text-slate-400">Org chat · channels · team</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden rounded-xl p-2 text-slate-400 hover:bg-slate-800/80 md:inline-flex"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className="px-2 pb-2">
          <div className={`relative rounded-xl ${communityTheme.searchBg}`}>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search name or role"
              className="w-full rounded-xl border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onStartNewChat}
              className={`flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:from-violet-500 hover:to-sky-500 ${canCreateChannel ? "flex-1" : "w-full"}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New chat
            </button>
            {canCreateChannel ? (
              <button
                type="button"
                onClick={onOpenNewChannel}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-600/60 bg-slate-900/80 px-2 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Channel
              </button>
            ) : null}
          </div>
        </div>
      )}

      {collapsed && (
        <div className="hidden flex-col gap-1 px-1 py-2 md:flex">
          <button
            type="button"
            title="New chat"
            onClick={onStartNewChat}
            className="rounded-xl p-2.5 text-lg hover:bg-violet-600/25"
          >
            ✏️
          </button>
          {(Object.keys(SECTION_META) as SidebarSection[]).map((s) => {
            const count =
              s === "chats"
                ? filteredConversations.length
                : s === "channels"
                  ? filteredChannels.length
                  : filteredPeople.length;
            const badge = s === "chats" ? chatUnread : s === "channels" ? channelUnread : undefined;
            return <div key={s}>{renderSectionHeader(s, count, badge)}</div>;
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!collapsed && (
          <>
            {renderSectionHeader("chats", filteredConversations.length, chatUnread)}
            {expandedSections.chats && (
              <div className="pb-1">
                {filteredConversations.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    {conversationsTotal === 0
                      ? "No chats yet. Open People and tap someone to message."
                      : "No matches."}
                  </div>
                ) : (
                  filteredConversations.map((c) => (
                    <ChatRow
                      key={c.id}
                      conversation={c}
                      selected={selectedConversationId === c.id}
                      myId={myId}
                      onSelect={onSelectConversation}
                    />
                  ))
                )}
              </div>
            )}

            {renderSectionHeader("channels", filteredChannels.length, channelUnread)}
            {expandedSections.channels && (
              <div className="pb-1">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Project channels</p>
                  {canCreateChannel ? (
                    <button
                      type="button"
                      onClick={onOpenNewChannel}
                      className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-violet-500 hover:to-sky-500"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New
                    </button>
                  ) : null}
                </div>
                {channelToast && (
                  <div className="mx-3 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-100">
                    {channelToast}
                  </div>
                )}
                {channelsLoading ? (
                  <div className="space-y-2 px-3 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-800/50" />
                    ))}
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-500">
                    <p>{canCreateChannel ? "No channels yet." : "No channels you are in yet."}</p>
                    {canCreateChannel ? (
                      <button
                        type="button"
                        onClick={onOpenNewChannel}
                        className="mt-3 rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 px-4 py-2 text-sm font-medium text-white"
                      >
                        Create from project
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-slate-600">Ask a director to create a channel and add you.</p>
                    )}
                  </div>
                ) : (
                  filteredChannels.map((c) => (
                    <ChannelRow
                      key={c.id}
                      conversation={c}
                      selected={selectedConversationId === c.id}
                      myId={myId}
                      onSelect={onSelectConversation}
                    />
                  ))
                )}
              </div>
            )}

            {renderSectionHeader("people", filteredPeople.length)}
            {expandedSections.people && (
              <div className="pb-4">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Organization · {onlineCount} online
                  </p>
                  <button
                    type="button"
                    onClick={onStartNewChat}
                    className="rounded-lg bg-violet-600/25 px-2.5 py-1 text-[11px] font-medium text-violet-200 hover:bg-violet-600/40"
                  >
                    Start chat
                  </button>
                </div>
                {filteredPeople.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    {onlineUsers.length === 0 ? "No other members in this org." : "No matches."}
                  </div>
                ) : (
                  filteredPeople.map((user) => (
                    <PersonRow
                      key={user.id}
                      user={user}
                      onMessage={onMessageUser}
                      onVoice={onVoiceCall}
                      onVideo={onVideoCall}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
