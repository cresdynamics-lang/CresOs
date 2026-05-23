"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth-context";
import { browserNotificationSoundAllowed } from "../../lib/notification-signals";
import { CommunityCallOverlay } from "../../components/community/community-call-overlay";
import { CommunityIncomingCall } from "../../components/community/community-incoming-call";
import { CommunityEmojiPicker } from "../../components/community/community-emoji-picker";
import { VoiceMessageMicIcon } from "../../components/community/call-icons";
import { CommunityMemberPicker } from "../../components/community/community-member-picker";
import { CommunitySidebar } from "../../components/community/community-sidebar";
import { useCommunityCalls } from "../../hooks/use-community-calls";
import { unlockCommunityCallAudio } from "../../lib/community-call-ring";
import { chatUiFor, communityTheme, directChatUi } from "../../components/community/community-theme";
import type {
  ChannelDraft,
  Conversation,
  Message,
  OnlineUser,
  SidebarSection
} from "../../components/community/community-types";
import {
  CommunityChannelBadge,
  formatMessageTime,
  initialsFromLabel,
  isChannelConversation
} from "../../components/community/community-utils";

function avatarUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const raw = String(pathOrUrl).trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function canCreateChannel(roleKeys: string[] | undefined): boolean {
  return Boolean(roleKeys?.includes("director_admin"));
}

function canDeleteChannelRole(roleKeys: string[] | undefined): boolean {
  return Boolean(
    roleKeys?.includes("admin") || roleKeys?.includes("director_admin")
  );
}

const LONG_PRESS_MS = 520;
const LONG_PRESS_MOVE_CANCEL_PX = 12;
const SWIPE_REPLY_PX = 52;

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function playCommunityBeep(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "square";
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // ignore
  }
}

function formatDaySeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - y.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function peerSubtitle(conv: Conversation | null, roster: OnlineUser[], myId?: string): string {
  if (!conv || !myId) return "";
  if (isChannelConversation(conv)) {
    const count = conv.participantCount ?? conv.participants.length;
    if (conv.channelTopics?.trim()) {
      const topic = conv.channelTopics.trim();
      return topic.length > 64 ? `${topic.slice(0, 64)}… · ${count} members` : `${topic} · ${count} members`;
    }
    const project = conv.linkedProjectName ?? conv.name;
    const status = conv.projectStatus?.replace(/_/g, " ") ?? "channel";
    return `${project} · ${count} members · ${status}`;
  }
  const otherId = conv.participants.find((p) => p !== myId);
  const peer = conv.otherUser ?? roster.find((u) => u.id === otherId);
  if (!peer) return conv.description || "Direct message";
  if (peer.isOnline) {
    if (peer.status === "online") return "online";
    return peer.status;
  }
  if (peer.lastSeen) {
    return `last seen ${formatTimestampShort(peer.lastSeen)}`;
  }
  return "offline — messages deliver when they’re back";
}

function resolveMediaUrl(pathOrUrl: string | null | undefined, apiOrigin: string): string | null {
  if (!pathOrUrl) return null;
  const raw = String(pathOrUrl).trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = apiOrigin.replace(/\/+$/, "");
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function renderMessageTicks(status: string): { glyph: string; className: string } {
  if (status === "read") return { glyph: "✓✓", className: "text-[#53BDEB] font-bold" };
  if (status === "delivered") return { glyph: "✓✓", className: "text-[#AEBAC1] font-bold" };
  return { glyph: "✓", className: "text-[#AEBAC1] font-bold" };
}

function ChatMessageBody({ message, apiOrigin }: { message: Message; apiOrigin: string }) {
  const md = message.metadata;
  const fileUrl = md && typeof md.url === "string" ? resolveMediaUrl(md.url, apiOrigin) : null;
  const fileName = md && typeof md.fileName === "string" ? md.fileName : null;

  const prettyBytes = (n: number | null): string | null => {
    if (n == null || !Number.isFinite(n)) return null;
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
  };

  if (message.type === "deleted" || message.revokedAt) {
    return <div className="italic text-[#8696A0]">This message was deleted.</div>;
  }

  if (message.type === "location" && md) {
    const lat = Number(md.lat);
    const lng = Number(md.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const href = `https://www.google.com/maps?q=${lat},${lng}`;
      return (
        <a href={href} target="_blank" rel="noreferrer" className="text-[#53BDEB] underline">
          Open location in Maps
        </a>
      );
    }
  }

  if (message.type === "contact" && md) {
    const name = typeof md.name === "string" ? md.name : "";
    const phone = typeof md.phone === "string" ? md.phone : "";
    return (
      <div className="rounded border border-[#2A3942] bg-[#111B21]/60 px-2 py-1.5 text-xs">
        <div className="font-medium text-[#E9EDEF]">{name || "Contact"}</div>
        {phone ? <div className="mt-0.5 text-[#AEBAC1]">{phone}</div> : null}
      </div>
    );
  }

  if (message.type === "image" && fileUrl) {
    return (
      <div className="space-y-1">
        <div className="relative overflow-hidden rounded-md border border-[#2A3942] bg-[#0B141A]">
          <img
            src={fileUrl}
            alt={fileName ?? ""}
            className="max-h-64 w-full max-w-full object-contain opacity-70"
          />
          <a
            href={fileUrl}
            download
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white hover:bg-black/75"
          >
            Download
          </a>
        </div>
        {message.content?.trim() ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-snug">{message.content}</div>
        ) : null}
      </div>
    );
  }

  if (message.type === "video" && fileUrl) {
    return (
      <div className="space-y-1">
        <div className="relative overflow-hidden rounded-md border border-[#2A3942] bg-[#0B141A]">
          <video src={fileUrl} controls className="max-h-56 w-full opacity-80" />
          <a
            href={fileUrl}
            download
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white hover:bg-black/75"
          >
            Download
          </a>
        </div>
        {message.content?.trim() ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-snug">{message.content}</div>
        ) : null}
      </div>
    );
  }

  if (message.type === "voice" && fileUrl) {
    return (
      <div className="space-y-1">
        <audio src={fileUrl} controls className="h-9 w-full max-w-[280px]" />
        <div className="flex flex-wrap gap-2 text-xs">
          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-[#53BDEB] underline">
            Open
          </a>
          <a href={fileUrl} download className="text-[#53BDEB] underline">
            Download
          </a>
        </div>
        {message.content?.trim() ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-snug">{message.content}</div>
        ) : null}
      </div>
    );
  }

  if ((message.type === "file" || message.type === "music") && fileUrl) {
    const fn = typeof md?.fileName === "string" ? md.fileName : "Attachment";
    const size = typeof md?.fileSize === "number" ? md.fileSize : null;
    const sizeLabel = prettyBytes(size);
    return (
      <div className="flex items-center justify-between gap-3 rounded border border-[#2A3942] bg-[#111B21]/60 px-2 py-2 text-xs">
        <div className="min-w-0">
          <div className="font-medium text-[#E9EDEF] break-all">{fn}</div>
          {sizeLabel ? <div className="mt-0.5 text-[#AEBAC1]">{sizeLabel}</div> : null}
        </div>
        <a
          href={fileUrl}
          download
          className="shrink-0 rounded-md bg-[#2A3942] px-3 py-1.5 text-xs font-semibold text-[#E9EDEF] hover:bg-[#324954]"
        >
          Download
        </a>
      </div>
    );
  }

  return <div className="whitespace-pre-wrap break-words text-sm leading-snug">{message.content}</div>;
}

function formatTimestampShort(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CommunityPage() {
  const { auth, apiFetch } = useAuth();
  const [sidebarPanel, setSidebarPanel] = useState<SidebarSection>("chats");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<SidebarSection, boolean>>({
    chats: true,
    channels: true,
    people: false
  });
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [channelDrafts, setChannelDrafts] = useState<ChannelDraft[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [creatingChannelProjectId, setCreatingChannelProjectId] = useState<string | null>(null);
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelProjectId, setNewChannelProjectId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopics, setNewChannelTopics] = useState("");
  const [newChannelMemberIds, setNewChannelMemberIds] = useState<string[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [channelToast, setChannelToast] = useState<string | null>(null);
  const [canCreateChannelFlag, setCanCreateChannelFlag] = useState(false);
  const [canDeleteChannel, setCanDeleteChannel] = useState(false);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  /** Chats / Channels / People list — collapses when opening a conversation. */
  const [listPanelOpen, setListPanelOpen] = useState(true);

  const selectConversation = useCallback((conv: Conversation) => {
    setSelectedConversation(conv);
    setListPanelOpen(false);
  }, []);

  const navigateSidebarPanel = useCallback((panel: SidebarSection) => {
    setSidebarPanel(panel);
    setExpandedSections((prev) => ({ ...prev, [panel]: true }));
    setListPanelOpen(true);
  }, []);

  const toggleSidebarSection = useCallback((section: SidebarSection) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const openStartNewChat = useCallback(() => {
    setShowNewChatModal(true);
    setSidebarPanel("people");
    setExpandedSections((prev) => ({ ...prev, people: true }));
    setListPanelOpen(true);
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesPage, setMessagesPage] = useState(1);
  const [messagesPages, setMessagesPages] = useState(1);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
  const [literalTypingMode, setLiteralTypingMode] = useState(false);
  const [assistPreview, setAssistPreview] = useState<{
    kind: "polish" | "translate";
    text: string;
    note?: string;
  } | null>(null);
  const [assistBusy, setAssistBusy] = useState(false);
  const translateSelectRef = useRef<HTMLSelectElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileAttachRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);
  const attachPortalRef = useRef<HTMLDivElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachMenuPos, setAttachMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; messageId: string } | null>(null);
  const [messageInfo, setMessageInfo] = useState<{
    messageId: string;
    data: { status: string; createdAt: string; editedAt: string | null; revokedAt: string | null; readBy: unknown };
  } | null>(null);

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceRecordingTimer, setVoiceRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);

  const [playCommunitySound, setPlayCommunitySound] = useState(false);
  const audioUnlockedRef = useRef(false);
  const lastUnreadTotalRef = useRef(0);
  const lastBeepAtRef = useRef(0);

  const wsUrl = useMemo(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");
    const wsBase = base.startsWith("https://")
      ? base.replace(/^https:\/\//, "wss://")
      : base.replace(/^http:\/\//, "ws://");
    const token = auth.accessToken ? encodeURIComponent(auth.accessToken) : "";
    return `${wsBase}/chat-community/ws?token=${token}`;
  }, [auth.accessToken]);

  const {
    callState,
    incomingCall,
    startCall: placeCall,
    endCall,
    acceptIncomingCall,
    rejectIncomingCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    toggleMinimize,
    toggleRaiseHand,
    sendCallEmoji,
    formatCallDuration
  } = useCommunityCalls({
    accessToken: auth.accessToken,
    userId: auth.userId,
    onlineUsers,
    wsUrl,
    onCallError: setChatError
  });

  const loadConversations = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const response = await apiFetch("/chat-community/conversations");
      if (response.ok) {
        const data = await response.json();
        const next = (data.data.conversations || []) as Conversation[];
        setConversations(next);

        if (
          playCommunitySound &&
          audioUnlockedRef.current &&
          browserNotificationSoundAllowed(auth.roleKeys ?? [])
        ) {
          const totalUnread = next.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0);
          const prevTotal = lastUnreadTotalRef.current;
          lastUnreadTotalRef.current = totalUnread;
          const now = Date.now();
          const shouldBeep = totalUnread > prevTotal;
          const rateOk = now - lastBeepAtRef.current > 2000;
          if (shouldBeep && rateOk) {
            lastBeepAtRef.current = now;
            playCommunityBeep();
          }
        }
        setChatError(null);
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        setChatError(err.error ?? err.message ?? `Could not load chats (${response.status})`);
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      setChatError("Network error loading chats. Is the API running?");
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, auth.roleKeys, apiFetch, playCommunitySound]);

  const startCall = useCallback(
    async (user: OnlineUser, callType: "voice" | "video") => {
      await placeCall(user, callType);
      try {
        const response = await apiFetch("/chat-community/conversations/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: user.id })
        });
        if (response.ok) {
          const data = (await response.json()) as { data?: { conversation?: Conversation } };
          const conv = data.data?.conversation;
          if (conv) {
            selectConversation(conv);
            setSidebarPanel("chats");
            void loadConversations();
          }
        }
      } catch {
        // call proceeds even if DM open fails
      }
    },
    [placeCall, apiFetch, selectConversation, loadConversations]
  );

  const loadChannels = useCallback(async () => {
    if (!auth.accessToken) return;
    setChannelsLoading(true);
    try {
      const response = await apiFetch("/chat-community/project-channels");
      if (response.ok) {
        const data = await response.json();
        const available = (data.data?.availableProjects || data.data?.channelDrafts || []) as ChannelDraft[];
        const channels = (data.data?.channels || []) as Conversation[];
        setChannelDrafts(available);
        setCanCreateChannelFlag(
          Boolean(data.data?.canCreateChannel) || canCreateChannel(auth.roleKeys)
        );
        setCanDeleteChannel(
          Boolean(data.data?.canDeleteChannel) || canDeleteChannelRole(auth.roleKeys)
        );
        setConversations((prev) => {
          const direct = prev.filter((c) => c.type === "direct");
          const merged = [...direct];
          for (const ch of channels) {
            if (!merged.some((c) => c.id === ch.id)) merged.push(ch);
          }
          return merged.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      }
    } catch (error) {
      console.error("Failed to load channels:", error);
    } finally {
      setChannelsLoading(false);
    }
  }, [auth.accessToken, apiFetch, auth.roleKeys]);

  const deleteChannel = useCallback(
    async (conv: Conversation) => {
      if (!auth.accessToken || !canDeleteChannel) return;
      const label = conv.name || conv.linkedProjectName || "this channel";
      if (
        !window.confirm(
          `Delete channel “${label}”? All messages will be permanently removed. The project can get a new channel later.`
        )
      ) {
        return;
      }
      const id = conv.projectId || conv.id;
      setDeletingChannelId(conv.id);
      try {
        const response = await apiFetch(`/chat-community/project-channels/${id}`, {
          method: "DELETE"
        });
        if (!response.ok) {
          const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
          alert(err.message ?? err.error ?? "Could not delete channel");
          return;
        }
        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        if (selectedConversation?.id === conv.id) {
          setSelectedConversation(null);
          setListPanelOpen(true);
        }
        setChannelToast("Channel deleted");
        window.setTimeout(() => setChannelToast(null), 4000);
        void loadChannels();
        void loadConversations();
      } catch (error) {
        console.error("Failed to delete channel:", error);
        alert("Network error deleting channel");
      } finally {
        setDeletingChannelId(null);
      }
    },
    [
      auth.accessToken,
      apiFetch,
      canDeleteChannel,
      loadChannels,
      loadConversations,
      selectedConversation?.id
    ]
  );

  const openNewChannelModal = useCallback(() => {
    if (!canCreateChannel(auth.roleKeys)) {
      setChatError("Only directors can create channels.");
      return;
    }
    void loadChannels();
    if (auth.userId) setNewChannelMemberIds([auth.userId]);
    setShowNewChannelModal(true);
  }, [loadChannels, auth.userId, auth.roleKeys]);

  const applyProjectTeamToChannel = useCallback(() => {
    const project = channelDrafts.find((p) => p.id === newChannelProjectId);
    if (!project?.suggestedMemberIds?.length || !auth.userId) return;
    setNewChannelMemberIds(
      Array.from(new Set([auth.userId, ...(project.suggestedMemberIds ?? [])]))
    );
  }, [channelDrafts, newChannelProjectId, auth.userId]);

  useEffect(() => {
    if (!showNewChannelModal) return;
    if (channelDrafts.length === 0) {
      setNewChannelProjectId("");
      return;
    }
    setNewChannelProjectId((prev) => {
      if (prev && channelDrafts.some((p) => p.id === prev)) return prev;
      return channelDrafts[0]!.id;
    });
  }, [showNewChannelModal, channelDrafts]);

  useEffect(() => {
    if (!showNewChannelModal || !newChannelProjectId) return;
    const project = channelDrafts.find((p) => p.id === newChannelProjectId);
    if (!project) return;
    setNewChannelName((prev) => {
      if (prev.trim()) return prev;
      return project.name;
    });
    setNewChannelTopics((prev) => {
      if (prev.trim()) return prev;
      return `Discussion for ${project.name} — updates, blockers, and deliverables.`;
    });
  }, [showNewChannelModal, newChannelProjectId, channelDrafts]);

  useEffect(() => {
    if (!showNewChannelModal || !newChannelProjectId || !auth.userId) return;
    const project = channelDrafts.find((p) => p.id === newChannelProjectId);
    const uid = auth.userId;
    if (!uid) return;
    if (!project?.suggestedMemberIds?.length) {
      setNewChannelMemberIds((prev) => (prev.length > 0 ? prev : [uid]));
      return;
    }
    setNewChannelMemberIds((prev) => {
      if (prev.length > 1) return prev;
      return Array.from(new Set([uid, ...project.suggestedMemberIds!]));
    });
  }, [showNewChannelModal, newChannelProjectId, channelDrafts, auth.userId]);

  const resetNewChannelForm = useCallback(() => {
    setNewChannelProjectId("");
    setNewChannelName("");
    setNewChannelTopics("");
    setNewChannelMemberIds(auth.userId ? [auth.userId] : []);
  }, [auth.userId]);

  const submitNewChannel = useCallback(async () => {
    if (!canCreateChannel(auth.roleKeys)) {
      setChatError("Only directors can create channels.");
      return;
    }
    if (!auth.accessToken || creatingChannelProjectId) return;
    const projectId = newChannelProjectId.trim();
    const channelName = newChannelName.trim();
    const topics = newChannelTopics.trim();
    if (!projectId) {
      alert("Select a project for this channel.");
      return;
    }
    if (!channelName) {
      alert("Enter a channel name.");
      return;
    }
    if (!topics) {
      alert("Describe what will be discussed in this channel.");
      return;
    }
    const memberIds = Array.from(new Set(newChannelMemberIds));
    if (memberIds.length === 0) {
      alert("Add at least one member — only selected people will see this channel.");
      return;
    }
    setCreatingChannelProjectId(projectId);
    try {
      const response = await apiFetch("/chat-community/project-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, channelName, topics, memberIds })
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        alert(err.error ?? err.message ?? "Could not create channel");
        return;
      }
      const data = await response.json();
      const conv = data.data?.conversation as Conversation | undefined;
      const msg = (data.message as string) || "Channel ready";
      if (conv) {
        setConversations((prev) => {
          const rest = prev.filter((c) => c.id !== conv.id);
          return [conv, ...rest].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
        selectConversation(conv);
        setSidebarPanel("channels");
      }
      setChannelDrafts((prev) => prev.filter((p) => p.id !== projectId));
      setChannelToast(msg);
      window.setTimeout(() => setChannelToast(null), 4000);
      setShowNewChannelModal(false);
      resetNewChannelForm();
      void loadConversations();
    } catch (error) {
      console.error("Failed to create channel:", error);
      alert("Network error creating channel");
    } finally {
      setCreatingChannelProjectId(null);
    }
  }, [
      auth.accessToken,
      apiFetch,
      creatingChannelProjectId,
      loadConversations,
      newChannelProjectId,
      newChannelName,
      newChannelTopics,
      newChannelMemberIds,
      resetNewChannelForm,
      selectConversation
    ]
  );

  useEffect(() => {
    if (!auth.accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/account/me");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { notificationPreferences?: any };
        setPlayCommunitySound(Boolean(data.notificationPreferences?.playCommunitySound));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.accessToken, apiFetch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (audioUnlockedRef.current) return;
    const unlock = () => {
      audioUnlockedRef.current = true;
      unlockCommunityCallAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!auth.accessToken) return;
    const run = async () => {
      try {
        const initRes = await apiFetch("/chat-community/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: auth.userName ?? undefined })
        });
        if (!initRes.ok) {
          const err = (await initRes.json().catch(() => ({}))) as { error?: string; message?: string };
          setChatError(
            err.message ?? err.error ?? "Chat could not be initialized"
          );
          return;
        }
        await apiFetch("/chat-community/status", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "online" })
        });
      } catch {
        setChatError("Could not reach chat service. Check the API and try again.");
      }
    };
    void run();
  }, [auth.accessToken, auth.userName, apiFetch]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!auth.accessToken) return;
    const t = setInterval(() => void loadConversations(), 35000);
    return () => clearInterval(t);
  }, [auth.accessToken, loadConversations]);

  useEffect(() => {
    if (!auth.accessToken) return;

    const fetchOnlineUsers = async () => {
      try {
        const response = await apiFetch("/chat-community/online-users");
        if (response.ok) {
          const data = await response.json();
          setOnlineUsers(data.data.onlineUsers || []);
        }
      } catch (error) {
        console.error("Failed to fetch org members:", error);
      }
    };

    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, [auth.accessToken, apiFetch]);

  const loadConversationMessages = useCallback(
    async (page: number, mode: "replace" | "prepend" = "replace") => {
      if (!selectedConversation) return;
      try {
        const response = await apiFetch(
          `/chat-community/conversations/${selectedConversation.id}/messages?page=${page}&limit=50`
        );
        if (response.ok) {
          const data = await response.json();
          const nextMessages = (data.data.messages || []) as Message[];
          const pagination = data.data.pagination as { page?: number; pages?: number } | undefined;
          setMessagesPage(pagination?.page ?? page);
          setMessagesPages(pagination?.pages ?? 1);
          setMessages((prev) => {
            if (mode === "prepend") {
              const seen = new Set(prev.map((m) => m.id));
              const older = nextMessages.filter((m) => !seen.has(m.id));
              return [...older, ...prev];
            }
            return nextMessages;
          });
          setChatError(null);

          if (mode === "replace" && auth.userId) {
            const unread = nextMessages.filter(
              (m) => m.senderId !== auth.userId && m.status !== "read"
            );
            if (unread.length > 0) {
              await Promise.allSettled(
                unread.map((m) =>
                  apiFetch(`/chat-community/messages/${m.id}/read`, {
                    method: "POST"
                  })
                )
              );
              void loadConversations();
            }
          }
        } else {
          const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
          setChatError(err.error ?? err.message ?? `Could not load messages (${response.status})`);
          setMessages([]);
          setMessagesPage(1);
          setMessagesPages(1);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        setChatError("Could not load messages.");
        setMessages([]);
        setMessagesPage(1);
        setMessagesPages(1);
      }
    },
    [selectedConversation, apiFetch, auth.userId, loadConversations]
  );

  useEffect(() => {
    if (!selectedConversation || !auth.accessToken) return;
    void loadConversationMessages(1, "replace");
  }, [selectedConversation, auth.accessToken, loadConversationMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedConversation || loadingOlderMessages || messagesPage >= messagesPages) return;
    setLoadingOlderMessages(true);
    try {
      await loadConversationMessages(messagesPage + 1, "prepend");
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [selectedConversation, loadingOlderMessages, messagesPage, messagesPages, loadConversationMessages]);

  useEffect(() => {
    setEditingMessageId(null);
    setEditDraft("");
    setMessageMenuId(null);
    setAttachMenuOpen(false);
    setReplyToId(null);
    setForwardingMessage(null);
    setAssistPreview(null);
  }, [selectedConversation?.id]);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem("cresos.community.literalTyping");
      if (v === "1") setLiteralTypingMode(true);
    } catch {
      // ignore
    }
  }, []);

  const runTranslate = useCallback(
    async (targetLanguage: string) => {
      const raw = (editingMessageId ? editDraft : newMessage).trim();
      if (!raw || literalTypingMode) return;
      setAssistBusy(true);
      setAssistPreview(null);
      try {
        const res = await apiFetch("/chat-community/compose-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: raw, action: "translate", targetLanguage })
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: { text?: string };
          error?: string;
        };
        if (!res.ok || !data.success || !data.data?.text) {
          if (data.error) setChatError(data.error);
          return;
        }
        const suggested = data.data.text.trim();
        if (!suggested) return;
        setAssistPreview({ kind: "translate", text: suggested, note: targetLanguage });
      } catch {
        setChatError("Translation request failed.");
      } finally {
        setAssistBusy(false);
        if (translateSelectRef.current) translateSelectRef.current.value = "";
      }
    },
    [apiFetch, editingMessageId, editDraft, newMessage, literalTypingMode]
  );

  useEffect(() => {
    setAssistPreview(null);
    if (!selectedConversation?.id) return;
    if (literalTypingMode || pendingFiles.length > 0) return;
    const raw = editingMessageId ? editDraft : newMessage;
    const draft = raw.trim();
    if (draft.length < 12 || draft.length > 4000) return;

    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setAssistBusy(true);
        try {
          const res = await apiFetch("/chat-community/compose-assist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: draft, action: "proofread" })
          });
          const data = (await res.json().catch(() => ({}))) as {
            success?: boolean;
            data?: { text?: string };
          };
          if (cancelled) return;
          if (!res.ok || !data.success || !data.data?.text) return;
          const suggested = data.data.text.trim();
          if (!suggested || norm(suggested) === norm(draft)) return;
          setAssistPreview({ kind: "polish", text: suggested });
        } finally {
          if (!cancelled) setAssistBusy(false);
        }
      })();
    }, 1400);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [
    newMessage,
    editDraft,
    editingMessageId,
    literalTypingMode,
    pendingFiles.length,
    selectedConversation?.id,
    apiFetch
  ]);

  // Draft cache per conversation
  useEffect(() => {
    if (!selectedConversation?.id) return;
    try {
      const key = `cresos.community.draft.${selectedConversation.id}`;
      const saved = localStorage.getItem(key);
      if (saved != null && saved !== newMessage) {
        setNewMessage(saved);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    try {
      const key = `cresos.community.draft.${selectedConversation.id}`;
      localStorage.setItem(key, newMessage);
    } catch {
      // ignore
    }
  }, [selectedConversation?.id, newMessage]);

  // Scroll position cache per conversation
  useEffect(() => {
    if (!selectedConversation?.id) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      try {
        sessionStorage.setItem(`cresos.community.scroll.${selectedConversation.id}`, String(el.scrollTop));
      } catch {
        // ignore
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll as any);
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    // Restore scrollTop if we have it; otherwise go to bottom.
    try {
      const saved = sessionStorage.getItem(`cresos.community.scroll.${selectedConversation.id}`);
      if (saved != null) {
        el.scrollTop = Math.max(0, Number(saved) || 0);
        return;
      }
    } catch {
      // ignore
    }
    el.scrollTop = el.scrollHeight;
  }, [selectedConversation?.id, messages.length]);

  useLayoutEffect(() => {
    if (!attachMenuOpen) {
      setAttachMenuPos(null);
      return;
    }
    const el = attachWrapRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setAttachMenuPos({ left: r.left, top: r.top });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [attachMenuOpen]);

  useEffect(() => {
    if (!attachMenuOpen) return;
    let removeListener: (() => void) | undefined;
    const openAt = window.setTimeout(() => {
      const onDown = (e: MouseEvent) => {
        const n = e.target as Node;
        if (attachWrapRef.current?.contains(n)) return;
        if (attachPortalRef.current?.contains(n)) return;
        setAttachMenuOpen(false);
      };
      document.addEventListener("mousedown", onDown);
      removeListener = () => document.removeEventListener("mousedown", onDown);
    }, 0);
    return () => {
      window.clearTimeout(openAt);
      removeListener?.();
    };
  }, [attachMenuOpen]);

  const isChannelView = Boolean(selectedConversation && isChannelConversation(selectedConversation));
  const activeChatUi = useMemo(() => chatUiFor(selectedConversation), [selectedConversation]);

  const showListPanel = listPanelOpen || !selectedConversation;
  const showChatPanel = Boolean(selectedConversation);
  const mayDeleteChannel = canDeleteChannel || canDeleteChannelRole(auth.roleKeys);
  const mayCreateChannel = canCreateChannelFlag || canCreateChannel(auth.roleKeys);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const openMessageMenu = useCallback((messageId: string) => {
    setMessageMenuId(messageId);
    try {
      navigator.vibrate?.(12);
    } catch {
      // ignore
    }
  }, []);

  const startMessageLongPress = useCallback(
    (messageId: string) => {
      cancelLongPress();
      longPressFiredRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        openMessageMenu(messageId);
      }, LONG_PRESS_MS);
    },
    [cancelLongPress, openMessageMenu]
  );

  useEffect(() => {
    return () => cancelLongPress();
  }, [cancelLongPress]);

  const directConversations = useMemo(
    () => conversations.filter((c) => c.type === "direct"),
    [conversations]
  );

  const channelConversations = useMemo(
    () => conversations.filter(isChannelConversation),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const list = directConversations;
    if (!q) return list;
    return list.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.otherUser?.roles?.some((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)))
        return true;
      if (c.lastMessage.content.toLowerCase().includes(q)) return true;
      if ((c.lastMessage.senderName || "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [directConversations, deferredSearchQuery]);

  const filteredChannels = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) return channelConversations;
    return channelConversations.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if ((c.projectStatus || "").toLowerCase().includes(q)) return true;
      if (c.lastMessage.content.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [channelConversations, deferredSearchQuery]);

  const filteredChannelDrafts = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) return channelDrafts;
    return channelDrafts.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.status.toLowerCase().includes(q)) return true;
      if (p.approvalStatus.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [channelDrafts, deferredSearchQuery]);

  useEffect(() => {
    if ((sidebarPanel === "channels" || showNewChannelModal) && auth.accessToken) {
      void loadChannels();
    }
  }, [sidebarPanel, showNewChannelModal, auth.accessToken, loadChannels]);

  const filteredPeople = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const sorted = [...onlineUsers].sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
    if (!q) return sorted;
    return sorted.filter((u) => {
      if (u.name.toLowerCase().includes(q)) return true;
      if (u.roles?.some((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [onlineUsers, deferredSearchQuery]);

  const chatUnreadTotal = useMemo(
    () => directConversations.reduce((n, c) => n + c.unreadCount, 0),
    [directConversations]
  );
  const channelUnreadTotal = useMemo(
    () => channelConversations.reduce((n, c) => n + c.unreadCount, 0),
    [channelConversations]
  );

  const selectedPeer = useMemo((): OnlineUser | null => {
    if (!selectedConversation) return null;
    const otherId = selectedConversation.participants.find((p) => p !== auth.userId);
    if (!otherId) return selectedConversation.otherUser ?? null;
    if (selectedConversation.otherUser?.id === otherId) return selectedConversation.otherUser;
    return onlineUsers.find((u) => u.id === otherId) ?? selectedConversation.otherUser ?? null;
  }, [selectedConversation, auth.userId, onlineUsers]);

  const handleSendMessage = async () => {
    if (editingMessageId) {
      await saveEditMessage();
      return;
    }
    if (!selectedConversation || !auth.accessToken) return;
    if (!auth.userId) {
      setChatError("Session is missing your user id. Refresh the page or sign out and sign in again.");
      return;
    }

    try {
      setChatError(null);

      if (pendingFiles.length > 0) {
        const caption = newMessage.trim();
        await uploadChatFiles(pendingFiles, caption, replyToId);
        setPendingFiles([]);
        if (caption) setNewMessage("");
        setReplyToId(null);
        return;
      }

      if (!newMessage.trim()) return;
      const response = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          type: "text",
          replyTo: replyToId
        })
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data.data.message;
        const nextMsg: Message = {
          id: raw.id,
          content: raw.content,
          senderId: raw.senderId,
          senderName: raw.senderName ?? "You",
          timestamp: raw.timestamp,
          type: raw.type === "system" ? "system" : "text",
          status: raw.status === "delivered" ? "delivered" : "sent",
          metadata: raw.metadata ?? null,
          flags: raw.flags ?? { starred: false, saved: false },
          editedAt: raw.editedAt ?? null,
          revokedAt: raw.revokedAt ?? null
        };
        setMessages((prev) => [...prev, nextMsg]);
        setNewMessage("");
        setReplyToId(null);

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation.id
              ? {
                  ...conv,
                  lastMessage: nextMsg,
                  updatedAt: new Date().toISOString()
                }
              : conv
          )
        );
        void loadConversations();
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        setChatError(err.error ?? err.message ?? `Send failed (${response.status})`);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setChatError("Could not send message. Check your connection.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    if (voiceRecordingTimer) {
      clearInterval(voiceRecordingTimer);
      setVoiceRecordingTimer(null);
    }

    setIsRecordingVoice(false);
  };

  const sendMessageToUser = async (user: OnlineUser) => {
    if (!auth.accessToken) return;
    if (!auth.userId) {
      setChatError("Session is missing your user id. Refresh the page or sign out and sign in again.");
      return;
    }

    try {
      setChatError(null);
      const response = await apiFetch("/chat-community/conversations/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          participantId: user.id
        })
      });

      if (response.ok) {
        const data = (await response.json()) as {
          data?: { conversation?: Conversation };
        };
        const conv = data.data?.conversation;
        if (!conv?.id) {
          setChatError("Chat was created but the app could not read it. Try again.");
          return;
        }
        setSidebarPanel("chats");
        setExpandedSections((prev) => ({ ...prev, chats: true }));
        setShowNewChatModal(false);
        selectConversation(conv);
        await loadConversations();
        requestAnimationFrame(() => {
          composerRef.current?.focus();
        });
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        setChatError(
          err.message ?? err.error ?? `Could not open chat (${response.status})`
        );
      }
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setChatError("Could not open chat. Check your connection.");
    }
  };

  const apiOrigin = useMemo(
    () => {
      const env = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
      if (env && !env.includes("localhost")) return env;
      if (typeof window !== "undefined") {
        // Prefer same-origin in production; most deployments reverse-proxy the API.
        return window.location.origin;
      }
      return (env || "http://localhost:4000").replace(/\/+$/, "");
    },
    []
  );

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = typeof window !== "undefined" ? Math.floor(window.innerHeight * 0.4) : 320;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [newMessage, editingMessageId, editDraft]);

  const appendMessageFromApi = useCallback((raw: Record<string, unknown>) => {
    const nextMsg: Message = {
      id: String(raw.id),
      content: String(raw.content ?? ""),
      senderId: String(raw.senderId),
      senderName: String(raw.senderName ?? "You"),
      timestamp: String(raw.timestamp),
      type: raw.type === "system" ? "system" : String(raw.type ?? "text"),
      status: raw.status === "delivered" ? "delivered" : "sent",
      metadata: (raw.metadata as Record<string, unknown>) ?? null,
      flags: (raw.flags as { starred?: boolean; saved?: boolean }) ?? { starred: false, saved: false },
      replyTo: raw.replyTo != null && raw.replyTo !== "" ? String(raw.replyTo) : null,
      editedAt: raw.editedAt ? String(raw.editedAt) : null,
      revokedAt: raw.revokedAt ? String(raw.revokedAt) : null
    };
    setMessages((prev) => [...prev, nextMsg]);
  }, []);

  const openChatFilePicker = useCallback((accept: string) => {
    const input = fileAttachRef.current;
    if (!input) return;
    if (accept) input.setAttribute("accept", accept);
    else input.removeAttribute("accept");
    input.click();
    setAttachMenuOpen(false);
  }, []);

  const uploadChatFiles = useCallback(
    async (files: File[], caption: string, replyTo: string | null) => {
      if (!selectedConversation?.id || !auth.accessToken) return;
      if (files.length === 0) return;
      setChatError(null);
      // Upload in small batches so large multi-file sends (e.g. 34 files / 500MB) don’t fail as a single massive request.
      // Keep caption only on the first batch (matches server behavior: first file takes caption; others get defaults).
      const BATCH_SIZE = 4;
      for (let start = 0; start < files.length; start += BATCH_SIZE) {
        const chunk = files.slice(start, start + BATCH_SIZE);
        const fd = new FormData();
        for (const f of chunk) fd.append("files", f);
        if (start === 0 && caption) fd.append("caption", caption);
        if (replyTo) fd.append("replyTo", replyTo);
        const response = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/upload`, {
          method: "POST",
          body: fd
        });
        if (!response.ok) {
          const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string; hint?: string };
          setChatError(err.hint ? `${err.error ?? "Upload failed"} — ${err.hint}` : err.error ?? err.message ?? "Upload failed");
          return;
        }
        const data = (await response.json()) as {
          data?: { message?: Record<string, unknown>; messages?: Record<string, unknown>[] };
        };
        const list = data.data?.messages ?? (data.data?.message ? [data.data.message] : []);
        if (list.length > 0) {
          for (const raw of list) appendMessageFromApi(raw);
        }
      }
      void loadConversations();
    },
    [selectedConversation, auth.accessToken, apiFetch, appendMessageFromApi, loadConversations]
  );

  const startVoiceRecording = async () => {
    try {
      setVoiceRecordingDuration(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      let mimeType = "";
      for (const t of preferredTypes) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }
      const recorder =
        mimeType && typeof MediaRecorder !== "undefined"
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mt = (recorder.mimeType && recorder.mimeType.length > 0 ? recorder.mimeType : mimeType) || "audio/webm";
        const blob = new Blob(chunks, { type: mt });
        const ext = mt.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mt });
        void uploadChatFiles([file], "", null);
        setVoiceRecordingDuration(0);
        stream.getTracks().forEach((track) => track.stop());
      };

      /* Timeslice so browsers reliably emit chunks before stop (important for Safari). */
      recorder.start(500);
      setMediaRecorder(recorder);
      setIsRecordingVoice(true);

      const timer = setInterval(() => {
        setVoiceRecordingDuration((prev) => prev + 1);
      }, 1000);
      setVoiceRecordingTimer(timer);
    } catch (error) {
      console.error("Failed to start voice recording:", error);
      alert("Failed to access microphone. Please check permissions.");
    }
  };

  const deleteMessageApi = useCallback(
    async (messageId: string, scope: "self" | "everyone") => {
      if (!selectedConversation?.id) return;
      setMessageMenuId(null);
      const res = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope })
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setChatError(err.error ?? "Delete failed");
        return;
      }
      if (scope === "everyone") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  content: "This message was deleted.",
                  type: "deleted",
                  revokedAt: new Date().toISOString(),
                  metadata: null,
                  editedAt: null
                }
              : m
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      void loadConversations();
    },
    [selectedConversation, apiFetch, loadConversations]
  );

  const updateMessageFlags = useCallback(
    async (messageId: string, patch: { starred?: boolean; saved?: boolean }) => {
      if (!selectedConversation?.id) return;
      setMessageMenuId(null);
      const res = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages/${messageId}/flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setChatError(err.error ?? "Could not update message");
        return;
      }
      const data = (await res.json()) as {
        data?: { flags?: { messageId: string; starred: boolean; saved: boolean } };
      };
      const flags = data.data?.flags;
      if (!flags) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === flags.messageId ? { ...m, flags: { starred: flags.starred, saved: flags.saved } } : m))
      );
    },
    [selectedConversation, apiFetch]
  );

  const loadMessageInfo = useCallback(
    async (messageId: string) => {
      if (!selectedConversation?.id) return;
      setMessageMenuId(null);
      const res = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages/${messageId}/info`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setChatError(err.error ?? "Could not load message info");
        return;
      }
      const payload = (await res.json()) as { data?: any };
      if (payload.data) setMessageInfo({ messageId, data: payload.data });
    },
    [selectedConversation, apiFetch]
  );

  const saveEditMessage = useCallback(async () => {
    if (!editingMessageId || !selectedConversation?.id) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    const res = await apiFetch(
      `/chat-community/conversations/${selectedConversation.id}/messages/${editingMessageId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed })
      }
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setChatError(err.error ?? "Could not save edit");
      return;
    }
    const data = (await res.json()) as { data?: { message?: Message } };
    const updated = data.data?.message;
    if (updated) {
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    }
    setEditingMessageId(null);
    setEditDraft("");
    void loadConversations();
  }, [editingMessageId, editDraft, selectedConversation, apiFetch, loadConversations]);

  const sendLocationMessage = useCallback(async () => {
    if (!selectedConversation?.id) {
      setChatError("Select a chat first.");
      return;
    }
    if (!navigator.geolocation) {
      setChatError("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "",
            type: "location",
            metadata: { lat: latitude, lng: longitude, accuracyM: pos.coords.accuracy }
          })
        });
        if (!res.ok) {
          setChatError("Could not send location");
          return;
        }
        const data = (await res.json()) as { data?: { message?: Record<string, unknown> } };
        const raw = data.data?.message;
        if (raw) appendMessageFromApi(raw);
        void loadConversations();
        setAttachMenuOpen(false);
      },
      () => setChatError("Location permission denied."),
      { enableHighAccuracy: true, timeout: 12_000 }
    );
  }, [selectedConversation, apiFetch, appendMessageFromApi, loadConversations]);

  const sendContactMessage = useCallback(async () => {
    const name = window.prompt("Contact name")?.trim();
    const phone = window.prompt("Phone or email")?.trim();
    if (!name && !phone) return;
    if (!selectedConversation?.id) return;
    const res = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "",
        type: "contact",
        metadata: { name: name || undefined, phone: phone || undefined }
      })
    });
    if (!res.ok) {
      setChatError("Could not send contact");
      return;
    }
    const data = (await res.json()) as { data?: { message?: Record<string, unknown> } };
    const raw = data.data?.message;
    if (raw) appendMessageFromApi(raw);
    void loadConversations();
    setAttachMenuOpen(false);
  }, [selectedConversation, apiFetch, appendMessageFromApi, loadConversations]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessageId) void saveEditMessage();
      else void handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 font-body">
        <div className="h-12 w-48 animate-pulse rounded-xl bg-slate-800/60" />
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="hidden w-72 shrink-0 flex-col gap-2 md:flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-800/40" />
            ))}
          </div>
          <div className="min-h-[200px] flex-1 animate-pulse rounded-2xl bg-slate-800/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-full flex-1 flex-col font-body">
      {chatError && (
        <div className="w-full shrink-0 px-2 pt-1 sm:px-0 sm:pt-0">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-600/50 bg-rose-950/50 px-3 py-2 text-xs text-rose-100 sm:text-sm">
            <span className="min-w-0">{chatError}</span>
            <button
              type="button"
              className="shrink-0 text-rose-200/90 hover:underline"
              onClick={() => setChatError(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div
        className={`flex min-h-0 flex-1 w-full flex-col overflow-hidden rounded-none md:flex-row md:rounded-2xl ${communityTheme.shell}`}
      >
        <CommunitySidebar
          visible={showListPanel}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          expandedSections={expandedSections}
          onToggleSection={toggleSidebarSection}
          activeSection={sidebarPanel}
          onFocusSection={navigateSidebarPanel}
          filteredConversations={filteredConversations}
          filteredChannels={filteredChannels}
          filteredPeople={filteredPeople}
          conversationsTotal={conversations.length}
          channelsLoading={channelsLoading}
          channelToast={channelToast}
          onlineUsers={onlineUsers}
          selectedConversationId={selectedConversation?.id ?? null}
          myId={auth.userId}
          onSelectConversation={selectConversation}
          canCreateChannel={mayCreateChannel}
          onOpenNewChannel={openNewChannelModal}
          onStartNewChat={openStartNewChat}
          onMessageUser={sendMessageToUser}
          onVoiceCall={(u) => void startCall(u, "voice")}
          onVideoCall={(u) => void startCall(u, "video")}
          chatUnread={chatUnreadTotal}
          channelUnread={channelUnreadTotal}
        />

      {/* ——— Right: conversation thread ——— */}
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col ${communityTheme.chatBg} ${
          showChatPanel
            ? listPanelOpen
              ? "hidden md:flex"
              : "flex"
            : "hidden md:flex"
        }`}
      >
        {selectedConversation ? (
          <>
            <div
              className={`flex flex-shrink-0 items-center gap-2 border-b border-black/20 px-2 py-2 sm:gap-3 sm:px-3 ${activeChatUi.header}`}
            >
              <button
                type="button"
                className={`shrink-0 rounded-full p-2 text-[#AEBAC1] hover:bg-[#2A3942] ${listPanelOpen ? "md:hidden" : ""}`}
                onClick={() => setListPanelOpen(true)}
                aria-label="Back to list"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {isChannelView ? (
                <CommunityChannelBadge className="h-10 w-10" />
              ) : (
              <div
                className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#6B7B8C] text-sm font-medium text-white"
              >
                {initialsFromLabel(selectedConversation.name)}
                {selectedConversation.type === "direct" && selectedPeer?.isOnline && (
                  <span
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#202C33]"
                    style={{ backgroundColor: activeChatUi.accent }}
                  />
                )}
              </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-[#E9EDEF]">{selectedConversation.name}</span>
                  {isChannelView ? (
                    <span className="shrink-0 rounded bg-[#2A3942] px-1.5 py-0.5 text-[10px] text-[#8696A0]">
                      Channel
                    </span>
                  ) : null}
                </div>
                {selectedPeer?.roles && selectedPeer.roles.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {selectedPeer.roles.map((r) => (
                      <span
                        key={r.key}
                        className="rounded bg-[#2A3942] px-1.5 py-0 text-[10px] text-[#AEBAC1]"
                      >
                        {r.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="truncate text-xs text-[#8696A0]">
                  {peerSubtitle(selectedConversation, onlineUsers, auth.userId)}
                </div>
              </div>
              {isChannelView && mayDeleteChannel ? (
                <button
                  type="button"
                  disabled={deletingChannelId === selectedConversation.id}
                  onClick={() => void deleteChannel(selectedConversation)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                  title="Delete channel (admin)"
                >
                  {deletingChannelId === selectedConversation.id ? "Deleting…" : "Delete channel"}
                </button>
              ) : null}
              {selectedPeer && selectedConversation.type === "direct" && (
                <div className="flex flex-shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void startCall(selectedPeer, "voice")}
                    className="rounded-full p-2.5 text-[#AEBAC1] hover:bg-[#2A3942] disabled:cursor-not-allowed disabled:opacity-30"
                    title="Voice call"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => void startCall(selectedPeer, "video")}
                    className="rounded-full p-2.5 text-[#AEBAC1] hover:bg-[#2A3942] disabled:cursor-not-allowed disabled:opacity-30"
                    title="Video call"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div
              className={`min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4 ${
                isChannelView ? "bg-[#0B141A]" : activeChatUi.wallpaper
              }`}
              ref={messagesScrollRef}
            >
              {!isChannelView ? (
                <p className="pointer-events-none mb-2 text-center text-[10px] text-[#8696A0]/70">
                  Long-press a message for options · swipe right to reply
                </p>
              ) : null}
              {messagesPages > 1 && messagesPage < messagesPages ? (
                <div className="mb-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadOlderMessages()}
                    disabled={loadingOlderMessages}
                    className="rounded-full border border-[#2A3942] bg-[#111B21]/80 px-3 py-1 text-xs text-[#AEBAC1] hover:bg-[#1B2A33] disabled:opacity-60"
                  >
                    {loadingOlderMessages ? "Loading older..." : "Load older messages"}
                  </button>
                </div>
              ) : null}
              {messages.length === 0 ? (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-[#8696A0]">
                  <p className="mb-1 text-sm">No messages yet</p>
                  <p className="max-w-xs text-xs">Send a message — it delivers even if they’re offline.</p>
                </div>
              ) : (
                messages.map((message, i) => {
                  const mine = message.senderId === auth.userId;
                  const prev = messages[i - 1];
                  const showDay =
                    !prev || dayKey(prev.timestamp) !== dayKey(message.timestamp);
                  return (
                    <div key={message.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_4rem]">
                      {showDay && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-lg bg-[#202C33]/90 px-3 py-1 text-xs text-[#AEBAC1] shadow-sm">
                            {formatDaySeparator(message.timestamp)}
                          </span>
                        </div>
                      )}
                      {isChannelView ? (
                        <div
                          className={`group/message mb-4 border-b border-[#2A3942]/40 pb-3 select-none touch-manipulation ${
                            messageMenuId === message.id ? activeChatUi.selectedRing : ""
                          } ${message.type === "deleted" || message.revokedAt ? "opacity-70" : ""}`}
                          onContextMenu={(e) => {
                            if (message.type === "deleted" || message.revokedAt) return;
                            e.preventDefault();
                            openMessageMenu(message.id);
                          }}
                          onMouseDown={() => {
                            if (message.type === "deleted" || message.revokedAt) return;
                            startMessageLongPress(message.id);
                          }}
                          onMouseUp={cancelLongPress}
                          onMouseLeave={cancelLongPress}
                        >
                          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-xs font-medium text-[#E9EDEF]">
                              {mine ? "You" : message.senderName}
                            </span>
                            <span className="text-[11px] text-[#8696A0]">
                              {formatMessageTime(message.timestamp)}
                              {message.editedAt ? " · edited" : ""}
                            </span>
                          </div>
                          {message.replyTo ? (
                            <div className="mb-2 border-l-2 border-[#8696A0]/60 pl-2 text-[11px] text-[#8696A0]">
                              {(messages.find((m2) => m2.id === message.replyTo)?.content ?? "").slice(0, 120)}
                            </div>
                          ) : null}
                          <ChatMessageBody message={message} apiOrigin={apiOrigin} />
                        </div>
                      ) : (
                      <div className={`group/message mb-1.5 flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`relative max-w-[min(85%,520px)] px-2.5 py-1.5 shadow-md select-none touch-manipulation ${
                            mine ? directChatUi.outgoingShape : directChatUi.incomingShape
                          } ${mine ? directChatUi.outgoing : directChatUi.incoming} ${
                            messageMenuId === message.id ? directChatUi.selectedRing : ""
                          } ${message.type === "deleted" || message.revokedAt ? "opacity-70" : ""}`}
                          onContextMenu={(e) => {
                            if (message.type === "deleted" || message.revokedAt) return;
                            e.preventDefault();
                            openMessageMenu(message.id);
                          }}
                          onTouchStart={(e) => {
                            if (message.type === "deleted" || message.revokedAt) return;
                            const t = e.touches[0];
                            if (!t) return;
                            touchStartRef.current = { x: t.clientX, y: t.clientY, messageId: message.id };
                            startMessageLongPress(message.id);
                          }}
                          onTouchMove={(e) => {
                            const start = touchStartRef.current;
                            if (!start || start.messageId !== message.id) return;
                            const t = e.touches[0];
                            if (!t) return;
                            const dx = t.clientX - start.x;
                            const dy = t.clientY - start.y;
                            if (Math.abs(dx) > LONG_PRESS_MOVE_CANCEL_PX || Math.abs(dy) > LONG_PRESS_MOVE_CANCEL_PX) {
                              cancelLongPress();
                            }
                            if (!longPressFiredRef.current && dx > SWIPE_REPLY_PX && Math.abs(dy) < 40) {
                              touchStartRef.current = null;
                              cancelLongPress();
                              setReplyToId(message.id);
                              requestAnimationFrame(() => composerRef.current?.focus());
                            }
                          }}
                          onTouchEnd={() => {
                            touchStartRef.current = null;
                            cancelLongPress();
                          }}
                          onTouchCancel={() => {
                            touchStartRef.current = null;
                            cancelLongPress();
                          }}
                          onMouseDown={() => {
                            if (message.type === "deleted" || message.revokedAt) return;
                            startMessageLongPress(message.id);
                          }}
                          onMouseUp={cancelLongPress}
                          onMouseLeave={cancelLongPress}
                        >
                          {message.replyTo ? (
                            <div
                              className={`mb-1 rounded-md bg-black/20 px-2 py-1 text-[11px] text-[#AEBAC1] ${directChatUi.replyBorder}`}
                            >
                              Replying to{" "}
                              <span className="font-medium text-[#E9EDEF]">
                                {messages.find((m2) => m2.id === message.replyTo)?.senderName ?? "message"}
                              </span>
                              :{" "}
                              <span className="text-[#8696A0]">
                                {(messages.find((m2) => m2.id === message.replyTo)?.content ?? "").slice(0, 80)}
                              </span>
                            </div>
                          ) : null}
                          <ChatMessageBody message={message} apiOrigin={apiOrigin} />
                          <div
                            className={`mt-0.5 flex flex-wrap items-center justify-end gap-1.5 text-[11px] ${
                              mine ? directChatUi.timeMine : directChatUi.timeTheir
                            }`}
                          >
                            {message.editedAt ? <span className="opacity-80">edited</span> : null}
                            <span>{formatMessageTime(message.timestamp)}</span>
                            {mine && (
                              <span className="inline-flex" title={message.status}>
                                {(() => {
                                  const t = renderMessageTicks(message.status);
                                  return (
                                    <span className={`${t.className} tracking-tight`} aria-label={message.status}>
                                      {t.glyph}
                                    </span>
                                  );
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {messageMenuId &&
              typeof document !== "undefined" &&
              (() => {
                const menuMessage = messages.find((m) => m.id === messageMenuId);
                if (!menuMessage || menuMessage.type === "deleted" || menuMessage.revokedAt) return null;
                const menuMine = menuMessage.senderId === auth.userId;
                const closeMenu = () => setMessageMenuId(null);
                const sheetBtn =
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] text-[#E9EDEF] active:bg-[#2A3942]";
                return createPortal(
                  <div
                    className="fixed inset-0 z-[140] flex flex-col justify-end bg-black/55"
                    role="dialog"
                    aria-label="Message options"
                    onClick={closeMenu}
                  >
                    <div
                      className={`message-menu-sheet mx-auto w-full max-w-lg rounded-t-2xl shadow-2xl ${activeChatUi.sheetBg}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="mx-auto my-2 h-1 w-10 rounded-full bg-[#3d4f56]" />
                      <div className="px-4 pb-2">
                        <p className="text-[11px] uppercase tracking-wide text-[#8696A0]">Message</p>
                        <p className="mt-1 line-clamp-2 text-sm text-[#E9EDEF]">
                          {menuMessage.content || "(attachment)"}
                        </p>
                      </div>
                      <div className="border-t border-[#2A3942]/80">
                        {menuMine && menuMessage.type === "text" && (
                          <button
                            type="button"
                            className={sheetBtn}
                            onClick={() => {
                              setEditingMessageId(menuMessage.id);
                              setEditDraft(menuMessage.content);
                              closeMenu();
                              requestAnimationFrame(() => composerRef.current?.focus());
                            }}
                          >
                            Edit
                          </button>
                        )}
                        <button type="button" className={sheetBtn} onClick={() => { setReplyToId(menuMessage.id); closeMenu(); requestAnimationFrame(() => composerRef.current?.focus()); }}>
                          Reply
                        </button>
                        <button type="button" className={sheetBtn} onClick={() => { setForwardingMessage(menuMessage); closeMenu(); }}>
                          Forward
                        </button>
                        <button type="button" className={sheetBtn} onClick={() => void updateMessageFlags(menuMessage.id, { starred: !(menuMessage.flags?.starred === true) })}>
                          {menuMessage.flags?.starred ? "Unstar" : "Star"}
                        </button>
                        <button type="button" className={sheetBtn} onClick={() => void updateMessageFlags(menuMessage.id, { saved: !(menuMessage.flags?.saved === true) })}>
                          {menuMessage.flags?.saved ? "Unsave" : "Save"}
                        </button>
                        <button type="button" className={sheetBtn} onClick={() => void loadMessageInfo(menuMessage.id)}>
                          Info
                        </button>
                        <button type="button" className={sheetBtn} onClick={() => void deleteMessageApi(menuMessage.id, "self")}>
                          Delete for me
                        </button>
                        {menuMine && (
                          <button
                            type="button"
                            className={`${sheetBtn} text-rose-300`}
                            onClick={() => {
                              if (window.confirm("Delete this message for everyone in the chat?")) {
                                void deleteMessageApi(menuMessage.id, "everyone");
                              }
                            }}
                          >
                            Delete for everyone
                          </button>
                        )}
                      </div>
                      <button type="button" className="mt-1 w-full border-t border-[#2A3942]/80 py-4 text-center text-[15px] font-medium text-[#53BDEB]" onClick={closeMenu}>
                        Cancel
                      </button>
                    </div>
                  </div>,
                  document.body
                );
              })()}

            {messageInfo &&
              typeof document !== "undefined" &&
              createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
                  <div className="w-full max-w-md rounded-xl border border-[#2A3942] bg-[#111B21] p-4 text-sm text-[#E9EDEF] shadow-xl">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#AEBAC1]">Message info</div>
                        <div className="mt-0.5 text-xs text-[#8696A0]">Status: {messageInfo.data.status}</div>
                      </div>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-[#53BDEB] hover:bg-[#2A3942]"
                        onClick={() => setMessageInfo(null)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="space-y-1 text-xs text-[#AEBAC1]">
                      <div>Sent: {new Date(messageInfo.data.createdAt).toLocaleString()}</div>
                      {messageInfo.data.editedAt ? <div>Edited: {new Date(messageInfo.data.editedAt).toLocaleString()}</div> : null}
                      {messageInfo.data.revokedAt ? <div>Deleted: {new Date(messageInfo.data.revokedAt).toLocaleString()}</div> : null}
                      <div>
                        Read by:{" "}
                        {Array.isArray(messageInfo.data.readBy) ? (messageInfo.data.readBy as unknown[]).length : 0}
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}

            {forwardingMessage &&
              typeof document !== "undefined" &&
              createPortal(
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4">
                  <div className="w-full max-w-lg rounded-xl border border-[#2A3942] bg-[#111B21] p-4 text-sm text-[#E9EDEF] shadow-xl">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#AEBAC1]">Forward message</div>
                        <div className="mt-0.5 text-xs text-[#8696A0]">Choose a chat to forward to.</div>
                      </div>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-[#53BDEB] hover:bg-[#2A3942]"
                        onClick={() => setForwardingMessage(null)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="max-h-[55vh] overflow-auto rounded-lg border border-[#2A3942]">
                      {filteredConversations.length === 0 ? (
                        <div className="p-3 text-xs text-[#AEBAC1]">No chats found.</div>
                      ) : (
                        <ul className="divide-y divide-[#2A3942]">
                          {filteredConversations.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#202C33]"
                                onClick={async () => {
                                  try {
                                    const meta =
                                      forwardingMessage.metadata && typeof forwardingMessage.metadata === "object"
                                        ? { ...forwardingMessage.metadata, forwarded: true, forwardedFromMessageId: forwardingMessage.id }
                                        : { forwarded: true, forwardedFromMessageId: forwardingMessage.id };
                                    const res = await apiFetch(`/chat-community/conversations/${c.id}/messages`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        content: forwardingMessage.content ?? "",
                                        type: forwardingMessage.type ?? "text",
                                        metadata: meta,
                                        replyTo: null
                                      })
                                    });
                                    if (!res.ok) {
                                      const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
                                      setChatError(err.error ?? err.message ?? "Forward failed");
                                      return;
                                    }
                                    setForwardingMessage(null);
                                    if (selectedConversation?.id === c.id) {
                                      const data = (await res.json()) as { data?: { message?: any } };
                                      const raw = data.data?.message;
                                      if (raw) appendMessageFromApi(raw);
                                    }
                                    void loadConversations();
                                  } catch {
                                    setChatError("Forward failed (network).");
                                  }
                                }}
                              >
                                <span className="min-w-0 truncate">{c.name || c.otherUser?.name || "Chat"}</span>
                                <span className="text-[11px] text-[#8696A0]">→</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}

            {editingMessageId && (
              <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-[#2A3942] bg-[#111B21] px-3 py-2 text-xs text-[#AEBAC1]">
                <span>Editing message</span>
                <button
                  type="button"
                  className="text-[#53BDEB] hover:underline"
                  onClick={() => {
                    setEditingMessageId(null);
                    setEditDraft("");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className={`flex flex-shrink-0 flex-col gap-1 border-t border-black/20 px-3 py-2 ${activeChatUi.inputBar}`}>
              {replyToId ? (
                <div
                  className={`mb-1 flex items-start justify-between gap-2 rounded-lg bg-[#111B21]/60 px-2 py-2 text-xs text-[#AEBAC1] ${activeChatUi.replyBorder}`}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-[#8696A0]">Replying</div>
                    <div className="truncate text-[#E9EDEF]">
                      {(messages.find((m) => m.id === replyToId)?.senderName ?? "Message")}
                      {": "}
                      {(messages.find((m) => m.id === replyToId)?.content ?? "").slice(0, 90)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded px-2 py-1 text-[#53BDEB] hover:bg-[#2A3942]"
                    onClick={() => setReplyToId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              {pendingFiles.length > 0 && (
                <div className="mb-1 rounded-lg border border-[#2A3942] bg-[#111B21]/60 px-2 py-2 text-xs text-[#AEBAC1]">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {pendingFiles.length} attachment{pendingFiles.length !== 1 ? "s" : ""} ready
                    </span>
                    <button
                      type="button"
                      className="text-[#53BDEB] hover:underline"
                      onClick={() => setPendingFiles([])}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex max-h-28 flex-col gap-1 overflow-auto pr-1">
                    {pendingFiles.slice(0, 12).map((f) => (
                      <div key={`${f.name}:${f.size}:${f.lastModified}`} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[#E9EDEF]">{f.name}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded px-2 py-0.5 text-[#AEBAC1] hover:bg-[#2A3942]"
                          onClick={() =>
                            setPendingFiles((prev) =>
                              prev.filter((x) => `${x.name}:${x.size}:${x.lastModified}` !== `${f.name}:${f.size}:${f.lastModified}`)
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {pendingFiles.length > 12 ? <div className="text-[#8696A0]">+{pendingFiles.length - 12} more…</div> : null}
                  </div>
                  <div className="mt-2 text-[11px] text-[#8696A0]">Tap Send to upload and deliver.</div>
                </div>
              )}
              {!isChannelView ? (
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[#8696A0]">
                <label className="flex cursor-pointer items-center gap-1.5 text-[#AEBAC1]">
                  <input
                    type="checkbox"
                    className="rounded border-[#2A3942] bg-[#111B21]"
                    checked={literalTypingMode}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setLiteralTypingMode(on);
                      if (on) setAssistPreview(null);
                      try {
                        sessionStorage.setItem("cresos.community.literalTyping", on ? "1" : "0");
                      } catch {
                        // ignore
                      }
                    }}
                  />
                  <span>Literal typing (keep spelling; no AI polish)</span>
                </label>
                <span className="hidden sm:inline">·</span>
              </div>
              ) : null}
              {!isChannelView && assistBusy && !assistPreview ? (
                <div className="mb-1 text-[11px] text-[#8696A0]">Working on wording…</div>
              ) : null}
              {!isChannelView && assistPreview ? (
                <div className="mb-1 rounded-lg border border-[#25D366]/35 bg-[#111B21]/90 px-2 py-2 text-xs text-[#E9EDEF]">
                  <div className="mb-1 text-[11px] font-medium text-[#53BDEB]">
                    {assistPreview.kind === "translate"
                      ? `Translation preview${assistPreview.note ? ` → ${assistPreview.note}` : ""}`
                      : "Suggested edit (grammar & spelling)"}
                  </div>
                  <p className="mb-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-[#AEBAC1]">{assistPreview.text}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded bg-[#25D366] px-2.5 py-1 text-[11px] font-medium text-[#111B21] hover:opacity-95"
                      onClick={() => {
                        const t = assistPreview.text;
                        if (editingMessageId) setEditDraft(t);
                        else setNewMessage(t);
                        setAssistPreview(null);
                      }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="rounded px-2.5 py-1 text-[11px] text-[#8696A0] hover:bg-[#2A3942]"
                      onClick={() => setAssistPreview(null)}
                    >
                      Keep what I typed
                    </button>
                  </div>
                </div>
              ) : null}
              <input
                ref={fileAttachRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : [];
                  if (list.length > 0) {
                    setPendingFiles((prev) => {
                      const seen = new Set(prev.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
                      const next = [...prev];
                      for (const f of list) {
                        const k = `${f.name}:${f.size}:${f.lastModified}`;
                        if (seen.has(k)) continue;
                        seen.add(k);
                        next.push(f);
                      }
                      return next;
                    });
                    requestAnimationFrame(() => composerRef.current?.focus());
                  }
                  e.target.value = "";
                  e.target.removeAttribute("accept");
                  setAttachMenuOpen(false);
                }}
                multiple
              />
              <div className="flex items-end gap-2">
                {!isChannelView ? (
                <button
                  type="button"
                  onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                  className={`mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                    isRecordingVoice ? "bg-red-600 text-white" : "bg-[#2A3942] text-[#AEBAC1] hover:bg-[#3B4A54]"
                  }`}
                  title={
                    isRecordingVoice
                      ? "Stop and send voice message"
                      : "Record voice — tap again when finished to upload"
                  }
                  aria-pressed={isRecordingVoice}
                >
                  <VoiceMessageMicIcon />
                </button>
                ) : null}
                {!isChannelView && isRecordingVoice && (
                  <span className="mb-2 text-xs tabular-nums text-red-400">{formatCallDuration(voiceRecordingDuration)}</span>
                )}
                {!isChannelView ? (
                <div ref={attachWrapRef} className="relative z-10 mb-0.5">
                  <button
                    type="button"
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#2A3942] text-[#AEBAC1] hover:bg-[#3B4A54]"
                    title="Attach file, photo, audio, or more"
                    aria-expanded={attachMenuOpen}
                    aria-haspopup="menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttachMenuOpen((o) => !o);
                    }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                </div>
                ) : null}
                {!isChannelView && typeof document !== "undefined" &&
                  attachMenuOpen &&
                  attachMenuPos &&
                  createPortal(
                    <div
                      ref={attachPortalRef}
                      role="menu"
                      className="min-w-[200px] rounded-lg border border-[#2A3942] bg-[#202C33] py-1 text-xs shadow-xl"
                      style={{
                        position: "fixed",
                        left: Math.max(8, attachMenuPos.left),
                        bottom: window.innerHeight - attachMenuPos.top + 8,
                        zIndex: 10050
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                        onClick={() => openChatFilePicker("image/*")}
                      >
                        Photos
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                        onClick={() => openChatFilePicker("audio/*")}
                      >
                        Audio / voice file
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                        onClick={() => openChatFilePicker("")}
                      >
                        Any file
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          void sendLocationMessage();
                        }}
                      >
                        Location
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          void sendContactMessage();
                        }}
                      >
                        Contact
                      </button>
                    </div>,
                    document.body
                  )}
                <div className="relative mb-0.5 min-w-0 flex-1">
                  <CommunityEmojiPicker
                    open={composerEmojiOpen}
                    onClose={() => setComposerEmojiOpen(false)}
                    onPick={(emoji) => {
                      if (editingMessageId) {
                        setEditDraft((t) => t + emoji);
                      } else {
                        setNewMessage((t) => t + emoji);
                      }
                      requestAnimationFrame(() => composerRef.current?.focus());
                    }}
                    className="absolute bottom-full left-0 z-30 mb-2 w-64"
                  />
                  <button
                    type="button"
                    className="absolute bottom-2 left-2 z-10 rounded-full p-1 text-lg text-[#8696A0] hover:bg-[#3B4A54] hover:text-[#E9EDEF]"
                    title="Insert emoji"
                    onClick={() => setComposerEmojiOpen((o) => !o)}
                  >
                    😊
                  </button>
                <textarea
                  ref={composerRef}
                  rows={1}
                  value={editingMessageId ? editDraft : newMessage}
                  onChange={(e) =>
                    editingMessageId ? setEditDraft(e.target.value) : setNewMessage(e.target.value)
                  }
                  onKeyDown={onInputKeyDown}
                  placeholder={
                    editingMessageId ? "Edit message…" : isChannelView ? "Write in channel…" : "Type a message"
                  }
                  spellCheck={!literalTypingMode}
                  autoCorrect={literalTypingMode ? "off" : "on"}
                  autoCapitalize="sentences"
                  className={`max-h-[40vh] min-h-[42px] w-full resize-none border-0 bg-[#2A3942] py-2.5 pl-10 pr-4 text-sm text-[#E9EDEF] placeholder-[#8696A0] focus:outline-none focus:ring-1 ${
                    isChannelView ? "rounded-lg" : "rounded-3xl"
                  } ${activeChatUi.composerFocus}`}
                />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!(editingMessageId ? editDraft.trim() : newMessage.trim()) && pendingFiles.length === 0}
                  className={`mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40 ${activeChatUi.sendBtn}`}
                  title="Send"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-6 rounded-full bg-[#202C33] p-8">
              <svg className="h-16 w-16 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-medium text-[#E9EDEF]">CresOS Community</h2>
            <p className="max-w-md text-sm text-[#8696A0]">
              Pick a chat on the left or go to <span className="text-[#25D366]">People</span> to see everyone in your
              organization. Messages work even when someone is offline.
            </p>
          </div>
        )}
      </div>

      {incomingCall && (
        <CommunityIncomingCall
          incoming={incomingCall}
          onAccept={() => void acceptIncomingCall()}
          onReject={rejectIncomingCall}
        />
      )}

      <CommunityCallOverlay
        callState={callState}
        durationLabel={formatCallDuration(callState.callDuration)}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={() => void toggleScreenShare()}
        onToggleMinimize={toggleMinimize}
        onToggleRaiseHand={toggleRaiseHand}
        onSendEmoji={sendCallEmoji}
        onEndCall={endCall}
      />

      {showNewChannelModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-channel-title"
            onClick={() => {
              setShowNewChannelModal(false);
              resetNewChannelForm();
            }}
          >
            <div
              className="flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-[#111B21] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#2A3942] px-4 py-3">
                <h2 id="new-channel-title" className="text-lg font-medium text-[#E9EDEF]">
                  Create channel
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewChannelModal(false);
                    resetNewChannelForm();
                  }}
                  className="rounded-full p-2 text-[#8696A0] hover:bg-[#2A3942] hover:text-[#E9EDEF]"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {channelsLoading ? (
                <p className="px-4 py-8 text-center text-sm text-[#8696A0]">Loading projects…</p>
              ) : channelDrafts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[#8696A0]">
                  No projects available for a new channel.
                </p>
              ) : (
                <form
                  className="flex flex-col gap-4 px-4 py-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitNewChannel();
                  }}
                >
                  <div>
                    <label htmlFor="channel-project" className="mb-1 block text-xs font-medium text-[#AEBAC1]">
                      Project to discuss
                    </label>
                    <select
                      id="channel-project"
                      value={newChannelProjectId}
                      onChange={(e) => setNewChannelProjectId(e.target.value)}
                      className="w-full rounded-lg border-0 bg-[#2A3942] px-3 py-2.5 text-sm text-[#E9EDEF] focus:outline-none focus:ring-1 focus:ring-[#25D366]/40"
                    >
                      {channelDrafts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.status.replace(/_/g, " ")}) · {p.teamMemberCount} members
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="channel-name" className="mb-1 block text-xs font-medium text-[#AEBAC1]">
                      Channel name
                    </label>
                    <input
                      id="channel-name"
                      type="text"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="e.g. Acme Website — Delivery"
                      maxLength={120}
                      className="w-full rounded-lg border-0 bg-[#2A3942] px-3 py-2.5 text-sm text-[#E9EDEF] placeholder-[#8696A0] focus:outline-none focus:ring-1 focus:ring-[#25D366]/40"
                    />
                  </div>

                  <div>
                    <label htmlFor="channel-topics" className="mb-1 block text-xs font-medium text-[#AEBAC1]">
                      What will be discussed?
                    </label>
                    <textarea
                      id="channel-topics"
                      value={newChannelTopics}
                      onChange={(e) => setNewChannelTopics(e.target.value)}
                      placeholder="Milestones, blockers, handoffs, client updates…"
                      rows={3}
                      maxLength={2000}
                      className="w-full resize-none rounded-lg border-0 bg-[#2A3942] px-3 py-2.5 text-sm text-[#E9EDEF] placeholder-[#8696A0] focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#AEBAC1]">Who can see this channel?</span>
                      <button
                        type="button"
                        onClick={applyProjectTeamToChannel}
                        className="text-[11px] text-violet-300 hover:underline"
                      >
                        Add project team
                      </button>
                    </div>
                    <CommunityMemberPicker
                      members={onlineUsers}
                      selectedIds={newChannelMemberIds}
                      onChange={setNewChannelMemberIds}
                      myId={auth.userId}
                      minSelected={1}
                      label="Channel members"
                      hint="Private channel — only selected people will see it in Community."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={Boolean(creatingChannelProjectId) || newChannelMemberIds.length < 1}
                    className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 py-3 text-sm font-medium text-white hover:from-violet-500 hover:to-sky-500 disabled:opacity-50"
                  >
                    {creatingChannelProjectId ? "Creating channel…" : "Create private channel"}
                  </button>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}

      {showNewChatModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-chat-title"
            onClick={() => setShowNewChatModal(false)}
          >
            <div
              className="flex max-h-[min(85dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
                <h2 id="new-chat-title" className="text-lg font-semibold text-white">
                  Start a chat
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="px-4 pt-2 text-xs text-slate-400">
                Choose someone in your organization. You can message them even when they are offline.
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {filteredPeople.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">No people match your search.</p>
                ) : (
                  filteredPeople.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => void sendMessageToUser(user)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-800/60"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/40 to-sky-600/30 text-sm font-semibold text-white">
                        {initialsFromLabel(user.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-100">{user.name}</span>
                        {user.roles?.[0] && (
                          <span className="block truncate text-xs text-slate-500">{user.roles[0].name}</span>
                        )}
                      </span>
                      <span className="text-xs font-medium text-violet-300">Message</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
    </div>
  );
}
