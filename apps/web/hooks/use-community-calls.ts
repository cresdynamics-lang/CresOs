"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OnlineUser } from "../components/community/community-types";
import {
  notifyIncomingCallIfHidden,
  startIncomingCallRing,
  startOutgoingRingback,
  stopAllCallSounds,
  stopIncomingCallRing,
  stopOutgoingRingback
} from "../lib/community-call-ring";
import {
  createCommunityPeerConnection,
  defaultMediaConstraints,
  IceCandidateQueue,
  renegotiateCall,
  replaceVideoTrack
} from "../lib/community-webrtc";

export type CallType = "voice" | "video";

export type IncomingCall = {
  callId: string;
  fromUserId: string;
  callType: CallType;
  callerName: string;
};

export type ActiveCallState = {
  isInCall: boolean;
  callType: CallType | null;
  callWith: OnlineUser | null;
  callDuration: number;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | "new";
};

const EMPTY_CALL: ActiveCallState = {
  isInCall: false,
  callType: null,
  callWith: null,
  callDuration: 0,
  isMuted: false,
  isVideoOn: false,
  isScreenSharing: false,
  localStream: null,
  remoteStream: null,
  connectionState: "new"
};

type UseCommunityCallsOptions = {
  accessToken: string | null;
  userId: string | undefined;
  onlineUsers: OnlineUser[];
  wsUrl: string;
  onCallError?: (message: string) => void;
};

export function useCommunityCalls({
  accessToken,
  userId,
  onlineUsers,
  wsUrl,
  onCallError
}: UseCommunityCallsOptions) {
  const [callState, setCallState] = useState<ActiveCallState>(EMPTY_CALL);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const activePeerIdRef = useRef<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const iceQueueRef = useRef(new IceCandidateQueue());
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInCallRef = useRef(false);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const isScreenSharingRef = useRef(false);
  const onlineUsersRef = useRef(onlineUsers);

  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  useEffect(() => {
    isInCallRef.current = callState.isInCall;
  }, [callState.isInCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    isScreenSharingRef.current = callState.isScreenSharing;
  }, [callState.isScreenSharing]);

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

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const startCallTimer = useCallback(() => {
    stopCallTimer();
    callTimerRef.current = setInterval(() => {
      setCallState((prev) => ({ ...prev, callDuration: prev.callDuration + 1 }));
    }, 1000);
  }, [stopCallTimer]);

  const cleanupMedia = useCallback(() => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    cameraTrackRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    iceQueueRef.current.clear();
  }, []);

  const endCall = useCallback(() => {
    stopAllCallSounds();
    const callId = activeCallIdRef.current;
    const toUserId = activePeerIdRef.current;
    if (callId && toUserId) {
      wsSend({ type: "call_hangup", callId, toUserId });
    }
    activeCallIdRef.current = null;
    activePeerIdRef.current = null;
    stopCallTimer();
    cleanupMedia();
    setIncomingCall(null);
    setCallState(EMPTY_CALL);
  }, [wsSend, stopCallTimer, cleanupMedia]);

  const sendIce = useCallback(
    (candidate: RTCIceCandidate) => {
      const toUserId = activePeerIdRef.current;
      const callId = activeCallIdRef.current;
      if (!toUserId || !callId) return;
      wsSend({
        type: "ice_candidate",
        callId,
        toUserId,
        candidate: candidate.toJSON()
      });
    },
    [wsSend]
  );

  const setupPeer = useCallback(
    (callType: CallType, localStream: MediaStream) => {
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) cameraTrackRef.current = videoTrack;

      const pc = createCommunityPeerConnection(
        sendIce,
        (stream) => {
          stream.getTracks().forEach((t) => {
            if (!remoteStream.getTracks().some((x) => x.id === t.id)) {
              remoteStream.addTrack(t);
            }
          });
          setCallState((prev) => ({ ...prev, remoteStream }));
        },
        (state) => {
          setCallState((prev) => ({ ...prev, connectionState: state }));
          if (state === "failed") {
            onCallError?.("Connection failed. Try again or check your network.");
          }
        }
      );

      pcRef.current = pc;
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      return { pc, remoteStream };
    },
    [sendIce, onCallError]
  );

  const beginActiveCall = useCallback(
    (peer: OnlineUser, callType: CallType, localStream: MediaStream, remoteStream: MediaStream) => {
      localStreamRef.current = localStream;
      setCallState({
        isInCall: true,
        callType,
        callWith: peer,
        callDuration: 0,
        isMuted: false,
        isVideoOn: callType === "video",
        isScreenSharing: false,
        localStream,
        remoteStream,
        connectionState: "connecting"
      });
      startCallTimer();
    },
    [startCallTimer]
  );

  const handleRemoteOffer = useCallback(
    async (callId: string, fromUserId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = pcRef.current;
      if (!pc || activeCallIdRef.current !== callId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await iceQueueRef.current.flush(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsSend({ type: "call_answer", callId, toUserId: fromUserId, sdp: answer });
    },
    [wsSend]
  );

  const handleRemoteAnswer = useCallback(
    async (callId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = pcRef.current;
      if (!pc || activeCallIdRef.current !== callId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await iceQueueRef.current.flush(pc);
    },
    []
  );

  const acceptIncomingCall = useCallback(async () => {
    const pending = incomingCall;
    if (!pending || !userId) return;

    stopIncomingCallRing();
    setIncomingCall(null);
    activeCallIdRef.current = pending.callId;
    activePeerIdRef.current = pending.fromUserId;

    const peer =
      onlineUsersRef.current.find((u) => u.id === pending.fromUserId) ||
      ({
        id: pending.fromUserId,
        name: pending.callerName,
        status: "online",
        lastSeen: null,
        isOnline: true
      } as OnlineUser);

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        defaultMediaConstraints(pending.callType)
      );
      const { remoteStream } = setupPeer(pending.callType, stream);
      beginActiveCall(peer, pending.callType, stream, remoteStream);
      wsSend({ type: "call_accept", callId: pending.callId, toUserId: pending.fromUserId });
    } catch {
      onCallError?.("Could not access camera or microphone.");
      endCall();
    }
  }, [incomingCall, userId, setupPeer, beginActiveCall, wsSend, onCallError, endCall]);

  const rejectIncomingCall = useCallback(() => {
    stopIncomingCallRing();
    const pending = incomingCall;
    if (pending) {
      wsSend({
        type: "call_reject",
        callId: pending.callId,
        toUserId: pending.fromUserId,
        reason: "rejected"
      });
    }
    setIncomingCall(null);
  }, [incomingCall, wsSend]);

  const startCall = useCallback(
    async (user: OnlineUser, callType: CallType) => {
      if (!accessToken || !userId) {
        onCallError?.("Sign in again to place calls.");
        return;
      }
      if (isInCallRef.current) {
        onCallError?.("You are already in a call.");
        return;
      }

      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        onCallError?.("Connecting to call service… try again in a moment.");
        return;
      }

      const callId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      activeCallIdRef.current = callId;
      activePeerIdRef.current = user.id;

      try {
        const stream = await navigator.mediaDevices.getUserMedia(defaultMediaConstraints(callType));
        const { remoteStream } = setupPeer(callType, stream);
        beginActiveCall(user, callType, stream, remoteStream);
        wsSend({ type: "call_request", callId, toUserId: user.id, callType });
        startOutgoingRingback();
      } catch {
        onCallError?.("Allow microphone and camera access to call.");
        endCall();
      }
    },
    [accessToken, userId, setupPeer, beginActiveCall, wsSend, onCallError, endCall]
  );

  const toggleMute = useCallback(() => {
    setCallState((prev) => {
      const next = !prev.isMuted;
      prev.localStream?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return { ...prev, isMuted: next };
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setCallState((prev) => {
      if (prev.isScreenSharing) return prev;
      const next = !prev.isVideoOn;
      if (cameraTrackRef.current) cameraTrackRef.current.enabled = next;
      prev.localStream?.getVideoTracks().forEach((t) => {
        if (t !== screenTrackRef.current) t.enabled = next;
      });
      return { ...prev, isVideoOn: next };
    });
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharingRef.current) return;
    const pc = pcRef.current;
    const callId = activeCallIdRef.current;
    const peerId = activePeerIdRef.current;
    if (!pc || !callId || !peerId) return;

    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    const cam = cameraTrackRef.current;
    if (cam) await replaceVideoTrack(pc, cam);
    setCallState((prev) => ({ ...prev, isScreenSharing: false, isVideoOn: Boolean(cam) }));
    await renegotiateCall(pc, (sdp) => {
      wsSend({ type: "call_offer", callId, toUserId: peerId, sdp });
    });
  }, [wsSend]);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    const callId = activeCallIdRef.current;
    const peerId = activePeerIdRef.current;
    if (!pc || !callId || !peerId) return;

    if (isScreenSharingRef.current) {
      await stopScreenShare();
      return;
    }

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) {
        display.getTracks().forEach((t) => t.stop());
        return;
      }
      screenTrackRef.current = screenTrack;
      screenTrack.onended = () => {
        void stopScreenShare();
      };
      await replaceVideoTrack(pc, screenTrack);
      setCallState((prev) => ({ ...prev, isScreenSharing: true, isVideoOn: true }));
      await renegotiateCall(pc, (sdp) => {
        wsSend({ type: "call_offer", callId, toUserId: peerId, sdp });
      });
    } catch {
      // user cancelled picker
    }
  }, [wsSend, stopScreenShare]);

  useEffect(() => {
    if (!accessToken) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = async (evt) => {
      try {
        const payload = JSON.parse(String(evt.data)) as Record<string, unknown>;
        const type = payload.type as string;
        if (!type) return;

        if (type === "error" && payload.code === "RECIPIENT_OFFLINE") {
          onCallError?.("They are not on Community right now. Ask them to open Community.");
          endCall();
          return;
        }

        if (type === "call_request") {
          const fromUserId = String(payload.fromUserId || "");
          const callId = String(payload.callId || "");
          const callType: CallType = payload.callType === "video" ? "video" : "voice";
          if (!fromUserId || !callId) return;

          if (isInCallRef.current || incomingCallRef.current) {
            wsSend({ type: "call_reject", callId, toUserId: fromUserId, reason: "busy" });
            return;
          }

          const label =
            onlineUsersRef.current.find((u) => u.id === fromUserId)?.name || "Someone";
          setIncomingCall({ callId, fromUserId, callType, callerName: label });
          notifyIncomingCallIfHidden(label, callType);
          return;
        }

        if (type === "call_accept") {
          stopOutgoingRingback();
          const callId = String(payload.callId || "");
          const fromUserId = String(payload.fromUserId || "");
          if (!callId || !fromUserId || activeCallIdRef.current !== callId) return;
          const pc = pcRef.current;
          if (!pc) return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsSend({ type: "call_offer", callId, toUserId: fromUserId, sdp: offer });
          return;
        }

        if (type === "call_offer") {
          const callId = String(payload.callId || "");
          const fromUserId = String(payload.fromUserId || "");
          const sdp = payload.sdp as RTCSessionDescriptionInit;
          if (!callId || !fromUserId || !sdp) return;
          if (activeCallIdRef.current !== callId) return;
          await handleRemoteOffer(callId, fromUserId, sdp);
          return;
        }

        if (type === "call_answer") {
          const callId = String(payload.callId || "");
          const sdp = payload.sdp as RTCSessionDescriptionInit;
          if (!callId || !sdp) return;
          await handleRemoteAnswer(callId, sdp);
          return;
        }

        if (type === "ice_candidate") {
          const callId = String(payload.callId || "");
          const candidate = payload.candidate as RTCIceCandidateInit;
          if (!callId || !candidate || activeCallIdRef.current !== callId) return;
          const pc = pcRef.current;
          if (!pc) return;
          await iceQueueRef.current.add(pc, candidate);
          return;
        }

        if (type === "call_reject") {
          stopOutgoingRingback();
          const callId = String(payload.callId || "");
          if (callId && activeCallIdRef.current === callId) {
            onCallError?.("Call declined.");
            endCall();
          }
          return;
        }

        if (type === "call_hangup") {
          const callId = String(payload.callId || "");
          if (callId && activeCallIdRef.current === callId) endCall();
          return;
        }
      } catch {
        // ignore malformed
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [
    accessToken,
    wsUrl,
    wsSend,
    endCall,
    handleRemoteOffer,
    handleRemoteAnswer,
    onCallError
  ]);

  useEffect(() => {
    if (incomingCall) {
      startIncomingCallRing();
      return () => stopIncomingCallRing();
    }
    stopIncomingCallRing();
    return undefined;
  }, [incomingCall]);

  useEffect(() => {
    return () => {
      stopCallTimer();
      cleanupMedia();
      stopAllCallSounds();
    };
  }, [stopCallTimer, cleanupMedia]);

  return {
    callState,
    incomingCall,
    startCall,
    endCall,
    acceptIncomingCall,
    rejectIncomingCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    formatCallDuration: (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
  };
}
