"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  type: "text" | "system";
  status: "sent" | "delivered" | "read";
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
  name: string;
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

export default function CommunityPage() {
  const { auth, apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<"conversations" | "inbox" | "online">("online");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
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
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [voiceRecordingTimer, setVoiceRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const [localVideoRef, setLocalVideoRef] = useState<HTMLVideoElement | null>(null);
  const [remoteVideoRef, setRemoteVideoRef] = useState<HTMLVideoElement | null>(null);
  const [isFullscreenPage, setIsFullscreenPage] = useState(true);

  // Fetch conversations
  useEffect(() => {
    if (!auth.accessToken) return;
    
    const fetchConversations = async () => {
      try {
        const response = await apiFetch("/chat-community/conversations");
        if (response.ok) {
          const data = await response.json();
          setConversations(data.data.conversations || []);
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [auth.accessToken, apiFetch]);

  // Fetch online users
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
        console.error("Failed to fetch online users:", error);
      }
    };

    fetchOnlineUsers();
    // Refresh online users every 30 seconds
    const interval = setInterval(fetchOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, [auth.accessToken, apiFetch]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation || !auth.accessToken) return;
    
    const fetchMessages = async () => {
      try {
        const response = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.data.messages || []);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };

    fetchMessages();
  }, [selectedConversation, auth.accessToken, apiFetch]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !auth.accessToken) return;

    try {
      const response = await apiFetch(`/chat-community/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: newMessage.trim(),
          type: "text"
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.data.message]);
        setNewMessage("");
        
        // Update last message in conversation list
        setConversations(prev => prev.map(conv => 
          conv.id === selectedConversation.id 
            ? { ...conv, lastMessage: data.data.message, updatedAt: new Date().toISOString() }
            : conv
        ));
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "busy": return "bg-red-500";
      case "away": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async (user: OnlineUser, callType: "voice" | "video") => {
    if (!auth.accessToken) return;
    
    try {
      // Get user media
      const constraints = {
        audio: true,
        video: callType === "video"
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create a direct conversation with the user
      const response = await apiFetch("/chat-community/conversations/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
        
        // Start call timer
        const timer = setInterval(() => {
          setCallState(prev => ({
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
    
    // Stop media streams
    if (callState.localStream) {
      callState.localStream.getTracks().forEach(track => track.stop());
    }
    if (callState.remoteStream) {
      callState.remoteStream.getTracks().forEach(track => track.stop());
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
      audioTracks.forEach(track => {
        track.enabled = !callState.isMuted;
      });
    }
    setCallState(prev => ({
      ...prev,
      isMuted: !prev.isMuted
    }));
  };

  const toggleVideo = () => {
    if (callState.localStream) {
      const videoTracks = callState.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !callState.isVideoOn;
      });
    }
    setCallState(prev => ({
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
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const voiceMessage: VoiceMessage = {
          id: Date.now().toString(),
          audioBlob: blob,
          duration: voiceRecordingDuration,
          timestamp: new Date().toISOString(),
          senderId: auth.userId || '',
          senderName: auth.userName || 'You',
          isPlaying: false
        };
        
        setVoiceMessages(prev => [...prev, voiceMessage]);
        setRecordedChunks([]);
        setVoiceRecordingDuration(0);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecordingVoice(true);
      
      // Start recording timer
      const timer = setInterval(() => {
        setVoiceRecordingDuration(prev => prev + 1);
      }, 1000);
      setVoiceRecordingTimer(timer);
      
    } catch (error) {
      console.error("Failed to start voice recording:", error);
      alert("Failed to access microphone. Please check permissions.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
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
    
    setVoiceMessages(prev => prev.map(vm => 
      vm.id === voiceMessage.id ? { ...vm, isPlaying: true } : vm
    ));
    
    audio.onended = () => {
      setVoiceMessages(prev => prev.map(vm => 
        vm.id === voiceMessage.id ? { ...vm, isPlaying: false } : vm
      ));
    };
  };

  const sendMessageToUser = async (user: OnlineUser) => {
    if (!auth.accessToken) return;
    
    try {
      // Create a direct conversation with the user
      const response = await apiFetch("/chat-community/conversations/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: user.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedConversation(data.data.conversation);
        setActiveTab("conversations");
      }
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading community...</div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-2rem)] gap-4 ${isFullscreenPage ? 'p-4' : ''}`}>
      {/* Navigation Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            title="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-slate-200">Community</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Dashboard
          </button>
          <button
            onClick={() => window.location.href = '/projects'}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Projects
          </button>
          <button
            onClick={() => window.location.href = '/finance'}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Finance
          </button>
          <button
            onClick={() => window.location.href = '/analytics'}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Analytics
          </button>
        </div>
      </div>

      <div className="flex gap-4">
      {/* Sidebar */}
      <div className="w-80 flex flex-col bg-slate-900/50 rounded-lg border border-slate-800">
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab("conversations")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "conversations"
                ? "bg-slate-800 text-brand border-b-2 border-brand"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Conversations
          </button>
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "inbox"
                ? "bg-slate-800 text-brand border-b-2 border-brand"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => setActiveTab("online")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "online"
                ? "bg-slate-800 text-brand border-b-2 border-brand"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Users ({onlineUsers.filter(user => user.isOnline).length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "conversations" && (
            <div className="p-2">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="mb-2">📭</div>
                  <div>No conversations yet</div>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedConversation?.id === conversation.id
                        ? "bg-brand/20 border border-brand/40"
                        : "hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="font-medium text-slate-200">{conversation.name}</div>
                      {conversation.unreadCount > 0 && (
                        <span className="bg-brand rounded-full px-2 py-0.5 text-xs text-white">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mb-1">{conversation.description}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {conversation.lastMessage.senderName}: {conversation.lastMessage.content}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {formatTimestamp(conversation.lastMessage.timestamp)}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === "online" && (
            <div className="p-2">
              <div className="text-xs text-slate-500 mb-2">USERS</div>
              {onlineUsers.filter(user => user.isOnline).length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="mb-2">👥</div>
                  <div>No users available</div>
                </div>
              ) : (
                onlineUsers.filter(user => user.isOnline).map((user) => (
                  <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium cursor-pointer hover:bg-slate-600 transition-colors"
                           onClick={() => {
                             // Show user profile modal
                             alert(`Profile: ${user.name}\nRole: ${user.status}\nStatus: Online`);
                           }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      {/* Green dot for online users */}
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-slate-900" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-200">{user.name}</div>
                      <div className="text-xs text-green-400">Online</div>
                    </div>
                    {user.lastSeen && (
                      <div className="text-xs text-slate-500">
                        {formatTimestamp(user.lastSeen)}
                      </div>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => sendMessageToUser(user)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Send message"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => startCall(user, "voice")}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-green-800 text-slate-400 hover:text-green-200 transition-colors"
                        title="Voice call"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => startCall(user, "video")}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-blue-800 text-slate-400 hover:text-blue-200 transition-colors"
                        title="Video call"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "inbox" && (
            <div className="p-2">
              <div className="text-xs text-slate-500 mb-2">INBOX</div>
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="mb-2">📨</div>
                  <div>No messages in inbox</div>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div key={conversation.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 cursor-pointer"
                       onClick={() => setSelectedConversation(conversation)}>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium">
                        {conversation.otherUser ? conversation.otherUser.name.charAt(0).toUpperCase() : conversation.name.charAt(0).toUpperCase()}
                      </div>
                      {conversation.otherUser?.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-slate-900" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-200">{conversation.otherUser?.name || conversation.name}</div>
                        <div className="text-xs text-slate-500">
                          {formatTimestamp(conversation.lastMessage.timestamp)}
                        </div>
                      </div>
                      <div className="text-sm text-slate-400 truncate">
                        {conversation.lastMessage.senderName}: {conversation.lastMessage.content}
                      </div>
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="w-5 h-5 rounded-full bg-brand text-white text-xs flex items-center justify-center">
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900/50 rounded-lg border border-slate-800">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-slate-200">{selectedConversation.name}</h3>
                <p className="text-sm text-slate-400">{selectedConversation.description}</p>
              </div>
              <div className="text-sm text-slate-400">
                {selectedConversation.participants.length} participants
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="mb-2">💬</div>
                  <div>No messages yet. Start the conversation!</div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.senderId === auth.userId ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        message.senderId === auth.userId
                          ? "bg-brand text-white"
                          : "bg-slate-800 text-slate-200"
                      }`}
                    >
                      <div className="text-xs opacity-75 mb-1">{message.senderName}</div>
                      <div>{message.content}</div>
                      <div className="text-xs opacity-60 mt-1">
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-slate-800">
              {/* Voice Messages */}
              {voiceMessages.length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="text-xs text-slate-500 mb-2">Voice Messages</div>
                  {voiceMessages.map((voiceMessage) => (
                    <div key={voiceMessage.id} className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg">
                      <button
                        onClick={() => playVoiceMessage(voiceMessage)}
                        className="p-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                        title={voiceMessage.isPlaying ? "Pause" : "Play"}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {voiceMessage.isPlaying ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          )}
                        </svg>
                      </button>
                      <div className="flex-1">
                        <div className="text-sm text-slate-200">{voiceMessage.senderName}</div>
                        <div className="text-xs text-slate-400">{formatCallDuration(voiceMessage.duration)}</div>
                      </div>
                      <div className="text-xs text-slate-500">{formatTimestamp(voiceMessage.timestamp)}</div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                {/* Voice Recording Button */}
                <button
                  onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                  className={`p-2 rounded-lg transition-colors ${
                    isRecordingVoice
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                  title={isRecordingVoice ? "Stop recording" : "Record voice message"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isRecordingVoice ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a7 7 0 017 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" />
                    )}
                  </svg>
                </button>
                
                {isRecordingVoice && (
                  <div className="flex items-center gap-2 text-sm text-red-400">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    {formatCallDuration(voiceRecordingDuration)}
                  </div>
                )}
                
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-400">
              <div className="mb-4 text-6xl">💬</div>
              <h3 className="text-xl font-semibold mb-2">CresOS Community</h3>
              <p className="mb-4">Connect with your team and collaborate in real-time.</p>
              <div className="space-y-2 text-sm">
                <div>🗨️ Start conversations with team members</div>
                <div>👥 See who's online and available</div>
                <div>📱 Stay connected with project discussions</div>
                <div>🔔 Get notifications for important messages</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Call Overlay */}
      {callState.isInCall && callState.callWith && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4">
            {/* Call Header */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-medium text-slate-200 mx-auto mb-3">
                {callState.callWith.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-xl font-semibold text-slate-200">{callState.callWith.name}</h3>
              <p className="text-slate-400 capitalize">{callState.callType} call</p>
              <p className="text-2xl font-mono text-brand mt-2">{formatCallDuration(callState.callDuration)}</p>
            </div>

            {/* Video Area (placeholder for video calls) */}
            {callState.callType === "video" && (
              <div className="space-y-4">
                <div className="bg-slate-800 rounded-lg h-48 flex items-center justify-center relative">
                  {callState.isVideoOn && callState.localStream ? (
                    <video
                      ref={(el) => {
                        if (el && callState.localStream) {
                          el.srcObject = callState.localStream;
                          el.muted = true;
                          el.play().catch(console.error);
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-slate-500">
                      {callState.isVideoOn ? "Camera starting..." : "Camera is off"}
                    </div>
                  )}
                  
                  {/* Remote video placeholder */}
                  {callState.remoteStream && (
                    <video
                      ref={(el) => {
                        if (el && callState.remoteStream) {
                          el.srcObject = callState.remoteStream;
                          el.play().catch(console.error);
                        }
                      }}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover rounded-lg"
                    />
                  )}
                </div>
                
                {/* Self-view */}
                {callState.localStream && callState.isVideoOn && (
                  <div className="bg-slate-800 rounded-lg h-24 w-32 mx-auto relative">
                    <video
                      ref={(el) => {
                        if (el && callState.localStream) {
                          el.srcObject = callState.localStream;
                          el.muted = true;
                          el.play().catch(console.error);
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute bottom-1 right-1 bg-slate-900/80 px-2 py-1 rounded text-xs text-slate-200">
                      You
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Call Controls */}
            <div className="flex justify-center gap-4">
              <button
                onClick={toggleMute}
                className={`p-3 rounded-full transition-colors ${
                  callState.isMuted 
                    ? "bg-red-600 hover:bg-red-700 text-white" 
                    : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                }`}
                title={callState.isMuted ? "Unmute" : "Mute"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {callState.isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a7 7 0 017 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" />
                  )}
                </svg>
              </button>

              {callState.callType === "video" && (
                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-full transition-colors ${
                    callState.isVideoOn 
                      ? "bg-slate-700 hover:bg-slate-600 text-slate-200" 
                      : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
                  title={callState.isVideoOn ? "Turn off camera" : "Turn on camera"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {callState.isVideoOn ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    )}
                  </svg>
                </button>
              )}

              <button
                onClick={endCall}
                className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                title="End call"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
