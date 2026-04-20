"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth-context";
import { browserNotificationSoundAllowed } from "../../lib/notification-signals";

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  type: "text" | "system" | string;
  status: "sent" | "delivered" | "read" | string;
  metadata?: Record<string, unknown> | null;
  flags?: { starred?: boolean; saved?: boolean } | null;
  editedAt?: string | null;
  revokedAt?: string | null;
}

interface OrgRoleRef {
  key: string;
  name: string;
}

interface Conversation {
  id: string;
  type: "project" | "direct" | "group";
  name: string;
  description: string;
  participants: string[];
  otherUser?: OnlineUser;
  lastMessage: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface OnlineUser {
  id: string;
  /** Resolved label: profile name, or email if no name */
  name: string;
  hasDisplayName?: boolean;
  roles?: OrgRoleRef[];
  status: "online" | "busy" | "away" | "offline";
  lastSeen: string | null;
  isOnline: boolean;
  avatar?: string | null;
  onlineHours?: string | null;
}

interface CallState {
  isInCall: boolean;
  callType: "voice" | "video" | null;
  callWith: OnlineUser | null;
  callDuration: number;
  isMuted: boolean;
  isVideoOn: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
}

/** WhatsApp-inspired dark palette (Web-style) */
const wa = {
  sidebarHeader: "bg-[#202C33]",
  sidebarBg: "bg-[#111B21]",
  chatHeader: "bg-[#202C33]",
  chatBg: "bg-[#0B141A]",
  listHover: "hover:bg-[#2A3942]",
  listActive: "bg-[#2A3942]",
  outgoing: "bg-[#005C4B]",
  incoming: "bg-[#202C33]",
  inputBar: "bg-[#202C33]",
  accent: "#25D366",
  border: "border-[#2A3942]"
};

function formatMessageTime(iso: string): string {
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

function initialsFromLabel(label: string): string {
  const c = label.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

function avatarUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const raw = String(pathOrUrl).trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function renderMessageTicks(status: string): { glyph: string; className: string } {
  if (status === "read") return { glyph: "✓✓", className: "text-[#53BDEB] font-bold" };
  if (status === "delivered") return { glyph: "✓✓", className: "text-[#AEBAC1] font-bold" };
  return { glyph: "✓", className: "text-[#AEBAC1] font-bold" };
}

function ChatMessageBody({ message }: { message: Message }) {
  const md = message.metadata;
  const fileUrl = md && typeof md.url === "string" ? avatarUrl(md.url) : null;

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
        <img src={fileUrl} alt="" className="max-h-64 max-w-full rounded-md object-contain" />
        {message.content?.trim() ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-snug">{message.content}</div>
        ) : null}
      </div>
    );
  }

  if (message.type === "video" && fileUrl) {
    return (
      <div className="space-y-1">
        <video src={fileUrl} controls className="max-h-56 max-w-full rounded-md" />
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
        {message.content?.trim() ? (
          <div className="whitespace-pre-wrap break-words text-sm leading-snug">{message.content}</div>
        ) : null}
      </div>
    );
  }

  if ((message.type === "file" || message.type === "music") && fileUrl) {
    const fn = typeof md?.fileName === "string" ? md.fileName : "Attachment";
    return (
      <a href={fileUrl} target="_blank" rel="noreferrer" className="break-all text-[#53BDEB] underline">
        {fn}
      </a>
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
  const [sidebarPanel, setSidebarPanel] = useState<"chats" | "people">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileAttachRef = useRef<HTMLInputElement>(null);
  const attachWrapRef = useRef<HTMLDivElement>(null);
  const attachPortalRef = useRef<HTMLDivElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachMenuPos, setAttachMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [messageInfo, setMessageInfo] = useState<{
    messageId: string;
    data: { status: string; createdAt: string; editedAt: string | null; revokedAt: string | null; readBy: unknown };
  } | null>(null);

  const [callState, setCallState] = useState<CallState>({
    isInCall: false,
    callType: null,
    callWith: null,
    callDuration: 0,
    isMuted: false,
    isVideoOn: false,
    localStream: null,
    remoteStream: null,
    peerConnection: null
  });
  const wsRef = useRef<WebSocket | null>(null);
  const wsReadyRef = useRef(false);
  const activeCallIdRef = useRef<string | null>(null);
  const activePeerIdRef = useRef<string | null>(null);
  const pendingInboundCallRef = useRef<{ callId: string; fromUserId: string; callType: "voice" | "video" } | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceRecordingTimer, setVoiceRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);

  const [playCommunitySound, setPlayCommunitySound] = useState(false);
  const audioUnlockedRef = useRef(false);
  const lastUnreadTotalRef = useRef(0);
  const lastBeepAtRef = useRef(0);

  const startCallTimer = useCallback(() => {
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    const timer = setInterval(() => {
      setCallState((prev) => ({
        ...prev,
        callDuration: prev.callDuration + 1
      }));
    }, 1000);
    setCallTimer(timer);
  }, [callTimer]);

  const wsSend = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (!ws) return;
    const sendNow = () => {
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        // ignore
      }
    };
    if (ws.readyState === WebSocket.OPEN) {
      sendNow();
      return;
    }
    if (ws.readyState === WebSocket.CONNECTING) {
      const onOpen = () => {
        ws.removeEventListener("open", onOpen);
        sendNow();
      };
      ws.addEventListener("open", onOpen);
    }
  }, []);

  const wsUrl = useMemo(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");
    const wsBase = base.startsWith("https://")
      ? base.replace(/^https:\/\//, "wss://")
      : base.replace(/^http:\/\//, "ws://");
    const token = auth.accessToken ? encodeURIComponent(auth.accessToken) : "";
    return `${wsBase}/chat-community/ws?token=${token}`;
  }, [auth.accessToken]);

  const ensureWs = useCallback((): WebSocket | null => {
    if (!auth.accessToken) return null;
    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing;
    }

    wsReadyRef.current = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      wsReadyRef.current = true;
    };

    ws.onclose = () => {
      wsReadyRef.current = false;
      if (wsRef.current === ws) wsRef.current = null;
    };

    ws.onerror = () => {
      wsReadyRef.current = false;
    };

    ws.onmessage = async (evt) => {
      try {
        const payload = JSON.parse(String(evt.data)) as any;
        if (!payload || typeof payload.type !== "string") return;

        if (payload.type === "call_request") {
          const fromUserId = String(payload.fromUserId || "");
          const callId = String(payload.callId || "");
          const callType = payload.callType === "video" ? "video" : "voice";
          if (!fromUserId || !callId) return;
          if (callState.isInCall) {
            ws.send(
              JSON.stringify({
                type: "call_reject",
                callId,
                toUserId: fromUserId,
                reason: "busy"
              })
            );
            return;
          }
          pendingInboundCallRef.current = { callId, fromUserId, callType };
          const label = onlineUsers.find((u) => u.id === fromUserId)?.name || "Someone";
          const ok = window.confirm(`${label} is calling you (${callType}). Accept?`);
          if (!ok) {
            ws.send(
              JSON.stringify({
                type: "call_reject",
                callId,
                toUserId: fromUserId,
                reason: "rejected"
              })
            );
            pendingInboundCallRef.current = null;
            return;
          }

          activeCallIdRef.current = callId;
          activePeerIdRef.current = fromUserId;

          const peer = onlineUsers.find((u) => u.id === fromUserId) || {
            id: fromUserId,
            name: label,
            status: "online",
            lastSeen: null,
            isOnline: true
          };

          const constraints = {
            audio: true,
            video: callType === "video"
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);

          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
          });

          pcRef.current = pc;
          localStreamRef.current = stream;

          const remoteStream = new MediaStream();
          remoteStreamRef.current = remoteStream;
          pc.ontrack = (e) => {
            e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
            setCallState((prev) => ({ ...prev, remoteStream }));
          };

          pc.onicecandidate = (e) => {
            if (!e.candidate) return;
            const toUserId = activePeerIdRef.current;
            const callId2 = activeCallIdRef.current;
            if (!toUserId || !callId2) return;
            ws.send(
              JSON.stringify({
                type: "ice_candidate",
                callId: callId2,
                toUserId,
                candidate: e.candidate
              })
            );
          };

          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          setCallState({
            isInCall: true,
            callType,
            callWith: peer as OnlineUser,
            callDuration: 0,
            isMuted: false,
            isVideoOn: callType === "video",
            localStream: stream,
            remoteStream,
            peerConnection: pc
          });

          startCallTimer();

          wsSend({ type: "call_accept", callId, toUserId: fromUserId });
          pendingInboundCallRef.current = null;
          return;
        }

        if (payload.type === "call_accept") {
          const callId = String(payload.callId || "");
          const fromUserId = String(payload.fromUserId || "");
          if (!callId || !fromUserId) return;
          if (activeCallIdRef.current !== callId) return;
          const pc = pcRef.current;
          if (!pc) return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsSend({ type: "call_offer", callId, toUserId: fromUserId, sdp: offer });
          return;
        }

        if (payload.type === "call_offer") {
          const callId = String(payload.callId || "");
          const fromUserId = String(payload.fromUserId || "");
          if (!callId || !fromUserId) return;
          if (activeCallIdRef.current !== callId) return;
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          wsSend({ type: "call_answer", callId, toUserId: fromUserId, sdp: answer });
          return;
        }

        if (payload.type === "call_answer") {
          const callId = String(payload.callId || "");
          if (!callId) return;
          if (activeCallIdRef.current !== callId) return;
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          return;
        }

        if (payload.type === "ice_candidate") {
          const callId = String(payload.callId || "");
          if (!callId) return;
          if (activeCallIdRef.current !== callId) return;
          const pc = pcRef.current;
          if (!pc) return;
          if (payload.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
          return;
        }

        if (payload.type === "call_reject") {
          const callId = String(payload.callId || "");
          if (!callId) return;
          if (activeCallIdRef.current !== callId) return;
          alert("Call rejected");
          endCall();
          return;
        }

        if (payload.type === "call_hangup") {
          const callId = String(payload.callId || "");
          if (!callId) return;
          if (activeCallIdRef.current !== callId) return;
          endCall();
          return;
        }
      } catch {
        return;
      }
    };

    return ws;
  }, [auth.accessToken, wsUrl, callState.isInCall, callState.peerConnection, onlineUsers]);

  useEffect(() => {
    return () => {
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, []);

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

  useEffect(() => {
    if (!selectedConversation || !auth.accessToken) return;

    const fetchMessages = async () => {
      try {
        const response = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages`);
        if (response.ok) {
          const data = await response.json();
          const nextMessages = (data.data.messages || []) as Message[];
          setMessages(nextMessages);
          setChatError(null);

          if (auth.userId) {
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
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        setChatError("Could not load messages.");
        setMessages([]);
      }
    };

    fetchMessages();
  }, [selectedConversation, auth.accessToken, auth.userId, apiFetch, loadConversations]);

  useEffect(() => {
    setEditingMessageId(null);
    setEditDraft("");
    setMessageMenuId(null);
    setAttachMenuOpen(false);
  }, [selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedConversation?.id]);

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

  useEffect(() => {
    if (!messageMenuId) return;
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.("[data-msg-menu-root]")) return;
      setMessageMenuId(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [messageMenuId]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.otherUser?.roles?.some((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)))
        return true;
      if (c.lastMessage.content.toLowerCase().includes(q)) return true;
      if ((c.lastMessage.senderName || "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [conversations, searchQuery]);

  const filteredPeople = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...onlineUsers].sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
    if (!q) return sorted;
    return sorted.filter((u) => {
      if (u.name.toLowerCase().includes(q)) return true;
      if (u.roles?.some((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [onlineUsers, searchQuery]);

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
    if (!newMessage.trim() || !selectedConversation || !auth.accessToken) return;
    if (!auth.userId) {
      setChatError("Session is missing your user id. Refresh the page or sign out and sign in again.");
      return;
    }

    try {
      setChatError(null);
      const response = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          type: "text"
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
          editedAt: raw.editedAt ?? null,
          revokedAt: raw.revokedAt ?? null
        };
        setMessages((prev) => [...prev, nextMsg]);
        setNewMessage("");

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-[#25D366]";
      case "busy":
        return "bg-red-500";
      case "away":
        return "bg-amber-400";
      case "offline":
        return "bg-slate-500";
      default:
        return "bg-slate-500";
    }
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startCall = async (user: OnlineUser, callType: "voice" | "video") => {
    if (!auth.accessToken) return;
    if (!user.isOnline) {
      alert("Voice and video calls are only available when the other person is online.");
      return;
    }
    if (!auth.userId) {
      alert("Missing user id. Refresh and try again.");
      return;
    }

    const ws = ensureWs();
    if (!ws) {
      alert("Could not connect to call service.");
      return;
    }

    const callId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    activeCallIdRef.current = callId;
    activePeerIdRef.current = user.id;

    try {
      const constraints = {
        audio: true,
        video: callType === "video"
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      pcRef.current = pc;
      localStreamRef.current = stream;

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        setCallState((prev) => ({ ...prev, remoteStream }));
      };

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const toUserId = activePeerIdRef.current;
        const callId2 = activeCallIdRef.current;
        if (!toUserId || !callId2) return;
        ws.send(
          JSON.stringify({
            type: "ice_candidate",
            callId: callId2,
            toUserId,
            candidate: e.candidate
          })
        );
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

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
        const data = await response.json();
        const conv = data.data?.conversation;
        if (conv) setSelectedConversation(conv);
        setSidebarPanel("chats");
        void loadConversations();
      }

      setCallState({
        isInCall: true,
        callType,
        callWith: user,
        callDuration: 0,
        isMuted: false,
        isVideoOn: callType === "video",
        localStream: stream,
        remoteStream,
        peerConnection: pc
      });

      startCallTimer();
      wsSend({ type: "call_request", callId, toUserId: user.id, callType });
    } catch (error) {
      console.error("Failed to start call:", error);
      alert("Failed to access camera/microphone. Please check permissions.");
      endCall();
    }
  };

  const endCall = () => {
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }

    const callId = activeCallIdRef.current;
    const toUserId = activePeerIdRef.current;
    if (callId && toUserId) {
      wsSend({ type: "call_hangup", callId, toUserId });
    }

    activeCallIdRef.current = null;
    activePeerIdRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
    }

    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pcRef.current = null;

    setCallState({
      isInCall: false,
      callType: null,
      callWith: null,
      callDuration: 0,
      isMuted: false,
      isVideoOn: false,
      localStream: null,
      remoteStream: null,
      peerConnection: null
    });
  };

  const toggleMute = () => {
    if (callState.localStream) {
      const audioTracks = callState.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !callState.isMuted;
      });
    }
    setCallState((prev) => ({
      ...prev,
      isMuted: !prev.isMuted
    }));
  };

  const toggleVideo = () => {
    if (callState.localStream) {
      const videoTracks = callState.localStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !callState.isVideoOn;
      });
    }
    setCallState((prev) => ({
      ...prev,
      isVideoOn: !prev.isVideoOn
    }));
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
        setSelectedConversation(conv);
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
    () => (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, ""),
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
    async (files: File[]) => {
      if (!selectedConversation?.id || !auth.accessToken) return;
      if (files.length === 0) return;
      setChatError(null);
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const cap = newMessage.trim();
      if (cap) fd.append("caption", cap);
      const response = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/upload`, {
        method: "POST",
        body: fd
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        setChatError(err.error ?? err.message ?? "Upload failed");
        return;
      }
      const data = (await response.json()) as {
        data?: { message?: Record<string, unknown>; messages?: Record<string, unknown>[] };
      };
      const list = data.data?.messages ?? (data.data?.message ? [data.data.message] : []);
      if (list.length > 0) {
        for (const raw of list) appendMessageFromApi(raw);
        if (cap) setNewMessage("");
        void loadConversations();
      }
    },
    [selectedConversation, auth.accessToken, apiFetch, newMessage, appendMessageFromApi, loadConversations]
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
        void uploadChatFiles([file]);
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
      <div className="flex min-h-0 flex-1 items-center justify-center font-body">
        <div className="text-slate-400">Loading Community…</div>
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
      <div className="flex min-h-0 flex-1 w-full flex-col overflow-hidden border-0 md:flex-row md:border md:border-[#2A3942]">
      {/* ——— Left: Chats + People (partitioned) ——— On small screens, hide when a 1:1 chat is open so the thread is full width. */}
      <div
        className={`flex min-h-0 w-full flex-shrink-0 flex-col border-b md:max-w-[400px] md:border-b-0 md:border-r ${wa.sidebarBg} ${wa.border} ${
          selectedConversation ? "hidden md:flex" : "flex"
        }`}
      >
        <div className={`flex items-center gap-2 px-3 py-3 ${wa.sidebarHeader}`}>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-full p-2 text-[#AEBAC1] hover:bg-[#2A3942]"
            title="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-medium text-[#E9EDEF]">Community</h1>
            <p className="truncate text-xs text-[#8696A0]">All org accounts — names and roles</p>
          </div>
        </div>

        <div className="px-2 pb-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8696A0]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or role"
              className="w-full rounded-lg border-0 bg-[#202C33] py-2 pl-9 pr-3 text-sm text-[#E9EDEF] placeholder-[#8696A0] focus:outline-none focus:ring-1 focus:ring-[#25D366]/50"
            />
          </div>
        </div>

        <div className={`flex border-b ${wa.border} px-2`}>
          <button
            type="button"
            onClick={() => setSidebarPanel("chats")}
            className={`flex-1 border-b-2 py-2.5 text-sm font-medium transition-colors ${
              sidebarPanel === "chats"
                ? "border-[#25D366] text-[#25D366]"
                : "border-transparent text-[#8696A0] hover:text-[#E9EDEF]"
            }`}
          >
            Chats
          </button>
          <button
            type="button"
            onClick={() => setSidebarPanel("people")}
            className={`flex-1 border-b-2 py-2.5 text-sm font-medium transition-colors ${
              sidebarPanel === "people"
                ? "border-[#25D366] text-[#25D366]"
                : "border-transparent text-[#8696A0] hover:text-[#E9EDEF]"
            }`}
          >
            People ({onlineUsers.length})
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {sidebarPanel === "chats" && (
            <div>
              {filteredConversations.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-[#8696A0]">
                  {conversations.length === 0
                    ? "No chats yet. Open People and tap someone to message them."
                    : "No matches."}
                </div>
              ) : (
                filteredConversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedConversation(c)}
                    className={`flex w-full items-center gap-3 border-b border-[#202C33] px-3 py-2.5 text-left transition-colors ${wa.listHover} ${
                      selectedConversation?.id === c.id ? wa.listActive : ""
                    }`}
                  >
                    <div className="relative h-12 w-12 flex-shrink-0 rounded-full bg-[#6B7B8C] text-center text-lg font-medium leading-[3rem] text-white">
                      {initialsFromLabel(c.name)}
                      {c.otherUser?.isOnline && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111B21] bg-[#25D366]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium text-[#E9EDEF]">{c.name}</span>
                        <span className="flex-shrink-0 text-[11px] text-[#8696A0]">
                          {formatMessageTime(c.lastMessage.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-[#8696A0]">
                          {c.lastMessage.senderId === auth.userId ? "You: " : ""}
                          {c.lastMessage.content}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[11px] font-medium text-[#111B21]">
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {sidebarPanel === "people" && (
            <div>
              <p className="px-4 py-2 text-[11px] uppercase tracking-wide text-[#8696A0]">
                Organization · {onlineUsers.filter((u) => u.isOnline).length} online
              </p>
              {filteredPeople.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-[#8696A0]">
                  {onlineUsers.length === 0 ? "No other members in this org." : "No matches."}
                </div>
              ) : (
                filteredPeople.map((user) => (
                  <div
                    key={user.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void sendMessageToUser(user)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void sendMessageToUser(user);
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-3 border-b border-[#202C33] px-3 py-2.5 outline-none ${wa.listHover} focus-visible:ring-2 focus-visible:ring-[#25D366]/50`}
                  >
                    <div className="relative h-12 w-12 flex-shrink-0 rounded-full bg-[#6B7B8C] text-center text-lg font-medium leading-[3rem] text-white">
                      {avatarUrl(user.avatar) ? (
                        <img
                          src={avatarUrl(user.avatar) as string}
                          alt={user.name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        initialsFromLabel(user.name)
                      )}
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111B21] ${getStatusColor(user.isOnline ? user.status : "offline")}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[#E9EDEF]">{user.name}</div>
                      {user.roles && user.roles.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {user.roles.map((r) => (
                            <span
                              key={`${user.id}-${r.key}`}
                              className="rounded bg-[#2A3942] px-1.5 py-0 text-[10px] text-[#AEBAC1]"
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {user.onlineHours && (
                        <div className="truncate text-[11px] text-[#8696A0]">Hours online: {user.onlineHours}</div>
                      )}
                      <div className={`truncate text-xs ${user.isOnline ? "text-[#25D366]" : "text-[#8696A0]"}`}>
                        {user.isOnline
                          ? user.status === "online"
                            ? "online — tap row to message"
                            : `${user.status} — tap row to message`
                          : "offline — tap row to open chat"}
                      </div>
                    </div>
                    <div
                      className="flex flex-shrink-0 gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => void sendMessageToUser(user)}
                        className="rounded-full p-2 text-[#25D366] hover:bg-[#2A3942]"
                        title="Open chat"
                        aria-label={`Message ${user.name}`}
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={!user.isOnline}
                        onClick={() => void startCall(user, "voice")}
                        className="rounded-full p-2 text-[#8696A0] hover:bg-[#2A3942] hover:text-[#E9EDEF] disabled:cursor-not-allowed disabled:opacity-30"
                        title={user.isOnline ? "Voice call" : "Online only"}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={!user.isOnline}
                        onClick={() => void startCall(user, "video")}
                        className="rounded-full p-2 text-[#8696A0] hover:bg-[#2A3942] hover:text-[#E9EDEF] disabled:cursor-not-allowed disabled:opacity-30"
                        title={user.isOnline ? "Video call" : "Online only"}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ——— Right: 1:1 conversation ——— Hidden on small screens until a chat is selected (list-only mode). */}
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col ${wa.chatBg} ${
          selectedConversation ? "flex" : "hidden md:flex"
        }`}
      >
        {selectedConversation ? (
          <>
            <div className={`flex flex-shrink-0 items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 ${wa.chatHeader}`}>
              <button
                type="button"
                className="shrink-0 rounded-full p-2 text-[#AEBAC1] hover:bg-[#2A3942] md:hidden"
                onClick={() => setSelectedConversation(null)}
                aria-label="Back to chats"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="relative h-10 w-10 flex-shrink-0 rounded-full bg-[#6B7B8C] text-center text-sm font-medium leading-10 text-white">
                {initialsFromLabel(selectedConversation.name)}
                {selectedPeer?.isOnline && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#202C33] bg-[#25D366]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[#E9EDEF]">{selectedConversation.name}</div>
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
              {selectedPeer && (
                <div className="flex flex-shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={!selectedPeer.isOnline}
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
                    disabled={!selectedPeer.isOnline}
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
              className="chat-pattern min-h-0 flex-1 overflow-y-auto px-4 py-2"
              style={{
                backgroundColor: "#0B141A",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232A3942' fill-opacity='0.35'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}
            >
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
                    <div key={message.id}>
                      {showDay && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-lg bg-[#202C33]/90 px-3 py-1 text-xs text-[#AEBAC1] shadow-sm">
                            {formatDaySeparator(message.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className={`group/message mb-1 flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`relative max-w-[min(85%,520px)] rounded-lg py-1.5 shadow-sm ${
                            mine
                              ? `${wa.outgoing} pl-2 pr-6 text-[#E9EDEF]`
                              : `${wa.incoming} pl-6 pr-2 text-[#E9EDEF]`
                          }`}
                        >
                          {message.type !== "deleted" && !message.revokedAt && (
                            <div
                              className={`absolute -top-1 z-10 flex flex-col gap-0 ${
                                mine ? "-right-1 items-end" : "-left-1 items-start"
                              }`}
                              data-msg-menu-root
                            >
                              <button
                                type="button"
                                aria-label="Message options"
                                className="rounded-full bg-[#111B21]/80 px-1.5 py-0.5 text-[11px] text-[#AEBAC1] opacity-0 shadow-sm transition-opacity hover:bg-[#2A3942] group-hover/message:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMessageMenuId((id) => (id === message.id ? null : message.id));
                                }}
                              >
                                ⋮
                              </button>
                              {messageMenuId === message.id ? (
                            <div
                              className="mt-1 min-w-[180px] rounded-lg border border-[#2A3942] bg-[#202C33] py-1 text-xs shadow-lg"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {mine && message.type === "text" && (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                                  onClick={() => {
                                    setEditingMessageId(message.id);
                                    setEditDraft(message.content);
                                    setMessageMenuId(null);
                                    requestAnimationFrame(() => composerRef.current?.focus());
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                                onClick={() => void updateMessageFlags(message.id, { starred: !(message.flags?.starred === true) })}
                              >
                                {message.flags?.starred ? "Unstar" : "Star"}
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                                onClick={() => void updateMessageFlags(message.id, { saved: !(message.flags?.saved === true) })}
                              >
                                {message.flags?.saved ? "Unsave" : "Save"}
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                                onClick={() => void loadMessageInfo(message.id)}
                              >
                                Info
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[#E9EDEF] hover:bg-[#2A3942]"
                                onClick={() => void deleteMessageApi(message.id, "self")}
                              >
                                Delete for me
                              </button>
                              {mine && (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-rose-200 hover:bg-[#2A3942]"
                                  onClick={() => {
                                    if (window.confirm("Delete this message for everyone in the chat?")) {
                                      void deleteMessageApi(message.id, "everyone");
                                    }
                                  }}
                                >
                                  Delete for everyone
                                </button>
                              )}
                            </div>
                              ) : null}
                            </div>
                          )}
                          <ChatMessageBody message={message} />
                          <div
                            className={`mt-0.5 flex flex-wrap items-center justify-end gap-1.5 text-[11px] ${
                              mine ? "text-[#A3E0D4]" : "text-[#8696A0]"
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
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

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

            <div className={`flex flex-shrink-0 flex-col gap-1 px-3 py-2 ${wa.inputBar}`}>
              <input
                ref={fileAttachRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : [];
                  if (list.length > 0) void uploadChatFiles(list);
                  e.target.value = "";
                  e.target.removeAttribute("accept");
                  setAttachMenuOpen(false);
                }}
                multiple
              />
              <div className="flex items-end gap-2">
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
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  </svg>
                </button>
                {isRecordingVoice && (
                  <span className="mb-2 text-xs tabular-nums text-red-400">{formatCallDuration(voiceRecordingDuration)}</span>
                )}
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
                {typeof document !== "undefined" &&
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
                <textarea
                  ref={composerRef}
                  rows={1}
                  value={editingMessageId ? editDraft : newMessage}
                  onChange={(e) =>
                    editingMessageId ? setEditDraft(e.target.value) : setNewMessage(e.target.value)
                  }
                  onKeyDown={onInputKeyDown}
                  placeholder={editingMessageId ? "Edit message…" : "Type a message"}
                  className="mb-0.5 max-h-[40vh] min-h-[42px] flex-1 resize-none rounded-lg border-0 bg-[#2A3942] px-4 py-2.5 text-sm text-[#E9EDEF] placeholder-[#8696A0] focus:outline-none focus:ring-1 focus:ring-[#25D366]/40"
                />
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!(editingMessageId ? editDraft.trim() : newMessage.trim())}
                  className="mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#111B21] transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: wa.accent }}
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

      {callState.isInCall && callState.callWith && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="mx-4 w-full max-w-md rounded-xl bg-[#202C33] p-6">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[#2A3942] text-2xl font-medium text-[#E9EDEF]">
                {initialsFromLabel(callState.callWith.name)}
              </div>
              <h3 className="text-xl font-semibold text-[#E9EDEF]">{callState.callWith.name}</h3>
              <p className="capitalize text-[#8696A0]">{callState.callType} call</p>
              <p className="mt-2 font-mono text-2xl text-[#25D366]">{formatCallDuration(callState.callDuration)}</p>
            </div>

            {callState.callType === "video" && (
              <div className="mb-4 space-y-4">
                <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-lg bg-[#111B21]">
                  {callState.remoteStream ? (
                    <video
                      ref={(el) => {
                        if (el && callState.remoteStream) {
                          el.srcObject = callState.remoteStream;
                          void el.play();
                        }
                      }}
                      autoPlay
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-[#8696A0]">Connecting…</div>
                  )}

                  {callState.localStream && (
                    <video
                      ref={(el) => {
                        if (el && callState.localStream) {
                          el.srcObject = callState.localStream;
                          el.muted = true;
                          void el.play();
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="absolute bottom-2 right-2 h-20 w-28 rounded-md object-cover ring-2 ring-black/30"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={toggleMute}
                className={`rounded-full p-3 transition-colors ${
                  callState.isMuted ? "bg-red-600 text-white" : "bg-[#2A3942] text-[#E9EDEF]"
                }`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a7 7 0 017 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" />
                </svg>
              </button>

              {callState.callType === "video" && (
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`rounded-full p-3 ${
                    callState.isVideoOn ? "bg-[#2A3942] text-[#E9EDEF]" : "bg-red-600 text-white"
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              )}

              <button type="button" onClick={endCall} className="rounded-full bg-red-600 p-3 text-white hover:bg-red-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-1c0-8.284-6.716-15-15-15H5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
