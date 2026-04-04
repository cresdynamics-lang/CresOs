"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth-context";

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  type: "text" | "system" | string;
  status: "sent" | "delivered" | "read" | string;
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
  email?: string;
  hasDisplayName?: boolean;
  roles?: OrgRoleRef[];
  status: "online" | "busy" | "away" | "offline";
  lastSeen: string | null;
  isOnline: boolean;
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

interface VoiceMessage {
  id: string;
  audioBlob: Blob;
  duration: number;
  timestamp: string;
  senderId: string;
  senderName: string;
  isPlaying: boolean;
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
  const messageInputRef = useRef<HTMLInputElement>(null);

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
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceRecordingTimer, setVoiceRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);

  const loadConversations = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const response = await apiFetch("/chat-community/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.data.conversations || []);
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
  }, [auth.accessToken, apiFetch]);

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
          setChatError(err.error ?? err.message ?? "Chat could not be initialized");
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
          setMessages(data.data.messages || []);
          setChatError(null);
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
  }, [selectedConversation, auth.accessToken, apiFetch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedConversation?.id]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.otherUser?.email?.toLowerCase().includes(q)) return true;
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
      if (u.email?.toLowerCase().includes(q)) return true;
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
          status: raw.status === "delivered" ? "delivered" : "sent"
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

    try {
      const constraints = {
        audio: true,
        video: callType === "video"
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
        setSelectedConversation(data.data.conversation);
        setCallState({
          isInCall: true,
          callType,
          callWith: user,
          callDuration: 0,
          isMuted: false,
          isVideoOn: callType === "video",
          localStream: stream,
          remoteStream: null,
          peerConnection: null
        });

        const timer = setInterval(() => {
          setCallState((prev) => ({
            ...prev,
            callDuration: prev.callDuration + 1
          }));
        }, 1000);
        setCallTimer(timer);
      }
    } catch (error) {
      console.error("Failed to start call:", error);
      alert("Failed to access camera/microphone. Please check permissions.");
    }
  };

  const endCall = () => {
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }

    if (callState.localStream) {
      callState.localStream.getTracks().forEach((track) => track.stop());
    }
    if (callState.remoteStream) {
      callState.remoteStream.getTracks().forEach((track) => track.stop());
    }
    if (callState.peerConnection) {
      callState.peerConnection.close();
    }

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

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const voiceMessage: VoiceMessage = {
          id: Date.now().toString(),
          audioBlob: blob,
          duration: voiceRecordingDuration,
          timestamp: new Date().toISOString(),
          senderId: auth.userId || "",
          senderName: auth.userName || "You",
          isPlaying: false
        };

        setVoiceMessages((prev) => [...prev, voiceMessage]);
        setVoiceRecordingDuration(0);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
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

  const playVoiceMessage = (voiceMessage: VoiceMessage) => {
    const audio = new Audio(URL.createObjectURL(voiceMessage.audioBlob));
    audio.play();

    setVoiceMessages((prev) =>
      prev.map((vm) => (vm.id === voiceMessage.id ? { ...vm, isPlaying: true } : vm))
    );

    audio.onended = () => {
      setVoiceMessages((prev) =>
        prev.map((vm) => (vm.id === voiceMessage.id ? { ...vm, isPlaying: false } : vm))
      );
    };
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
        const data = await response.json();
        setSelectedConversation(data.data.conversation);
        setSidebarPanel("chats");
        await loadConversations();
        requestAnimationFrame(() => {
          messageInputRef.current?.focus();
        });
      } else {
        const err = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        setChatError(err.error ?? err.message ?? `Could not open chat (${response.status})`);
      }
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setChatError("Could not open chat. Check your connection.");
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center font-body">
        <div className="text-slate-400">Loading Community…</div>
      </div>
    );
  }

  return (
    <>
      {chatError && (
        <div className="mx-auto mb-2 w-full max-w-[1600px] px-2 font-body">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-600/50 bg-rose-950/50 px-3 py-2 text-sm text-rose-100">
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
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[480px] max-w-[1600px] mx-auto overflow-hidden rounded-lg border border-[#2A3942] font-body shadow-xl">
      {/* ——— Left: Chats + People (partitioned) ——— */}
      <div className={`flex w-full max-w-[400px] flex-shrink-0 flex-col ${wa.sidebarBg} border-r ${wa.border}`}>
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
            <p className="truncate text-xs text-[#8696A0]">All org accounts — names or email</p>
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
              placeholder="Search name, email, or role"
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
                    <div className="relative h-12 w-12 flex-shrink-0 rounded-full bg-[#6B7B8C] text-lg font-medium leading-[3rem] text-white">
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
                      {c.otherUser?.hasDisplayName && c.otherUser.email && (
                        <p className="truncate text-[11px] text-[#8696A0]">{c.otherUser.email}</p>
                      )}
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
                      {initialsFromLabel(user.name)}
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111B21] ${getStatusColor(user.isOnline ? user.status : "offline")}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[#E9EDEF]">{user.name}</div>
                      {user.hasDisplayName && user.email && (
                        <div className="truncate text-[11px] text-[#8696A0]">{user.email}</div>
                      )}
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

      {/* ——— Right: Conversation ——— */}
      <div className={`flex min-w-0 min-h-0 flex-1 flex-col ${wa.chatBg}`}>
        {selectedConversation ? (
          <>
            <div className={`flex flex-shrink-0 items-center gap-3 px-3 py-2 ${wa.chatHeader}`}>
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
                  {selectedPeer?.hasDisplayName && selectedPeer.email ? (
                    <span className="text-[#8696A0]">{selectedPeer.email} · </span>
                  ) : null}
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
                      <div className={`mb-1 flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[min(85%,520px)] rounded-lg px-2 py-1.5 shadow-sm ${
                            mine ? `${wa.outgoing} text-[#E9EDEF]` : `${wa.incoming} text-[#E9EDEF]`
                          }`}
                        >
                          <div className="whitespace-pre-wrap break-words text-sm leading-snug">{message.content}</div>
                          <div
                            className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${
                              mine ? "text-[#A3E0D4]" : "text-[#8696A0]"
                            }`}
                          >
                            <span>{formatMessageTime(message.timestamp)}</span>
                            {mine && (
                              <span className="inline-flex" title={message.status}>
                                {message.status === "read" ? (
                                  <span className="text-[#53BDEB]">✓✓</span>
                                ) : (
                                  <span>✓✓</span>
                                )}
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

            {voiceMessages.length > 0 && (
              <div className="border-t border-[#2A3942] bg-[#111B21] px-3 py-2">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#8696A0]">Voice notes (local)</div>
                <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                  {voiceMessages.map((vm) => (
                    <button
                      key={vm.id}
                      type="button"
                      onClick={() => playVoiceMessage(vm)}
                      className="flex items-center gap-2 rounded-full bg-[#202C33] px-3 py-1.5 text-left text-xs text-[#E9EDEF] hover:bg-[#2A3942]"
                    >
                      <span className="text-[#25D366]">{vm.isPlaying ? "■" : "▶"}</span>
                      {formatCallDuration(vm.duration)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={`flex flex-shrink-0 items-end gap-2 px-3 py-2 ${wa.inputBar}`}>
              <button
                type="button"
                onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                className={`mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                  isRecordingVoice ? "bg-red-600 text-white" : "bg-[#2A3942] text-[#AEBAC1] hover:bg-[#3B4A54]"
                }`}
                title={isRecordingVoice ? "Stop" : "Record"}
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                </svg>
              </button>
              {isRecordingVoice && (
                <span className="mb-2 text-xs tabular-nums text-red-400">{formatCallDuration(voiceRecordingDuration)}</span>
              )}
              <input
                ref={messageInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Type a message"
                className="mb-0.5 min-h-[42px] flex-1 rounded-lg border-0 bg-[#2A3942] px-4 py-2.5 text-sm text-[#E9EDEF] placeholder-[#8696A0] focus:outline-none focus:ring-1 focus:ring-[#25D366]/40"
              />
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!newMessage.trim()}
                className="mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#111B21] transition-opacity disabled:opacity-40"
                style={{ backgroundColor: wa.accent }}
                title="Send"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
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
                <div className="relative flex h-48 items-center justify-center rounded-lg bg-[#111B21]">
                  {callState.isVideoOn && callState.localStream ? (
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
                      className="h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="text-[#8696A0]">{callState.isVideoOn ? "Starting camera…" : "Camera off"}</div>
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
    </>
  );
}
