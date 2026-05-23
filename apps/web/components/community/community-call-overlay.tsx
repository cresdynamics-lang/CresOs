"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveCallState } from "../../hooks/use-community-calls";
import { getCallStatusLabel } from "../../hooks/use-community-calls";
import { CommunityEmojiPicker } from "./community-emoji-picker";
import { initialsFromLabel } from "./community-utils";
import {
  HangupIcon,
  MicIcon,
  MicOffIcon,
  ScreenShareIcon,
  ScreenShareStopIcon,
  VideoCamIcon,
  VideoCamOffIcon
} from "./call-icons";

type Props = {
  callState: ActiveCallState;
  durationLabel: string;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleMinimize: () => void;
  onToggleRaiseHand: () => void;
  onSendEmoji: (emoji: string) => void;
  onEndCall: () => void;
};

function FullscreenIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
      />
    </svg>
  );
}

function MinimizeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function RaiseHandIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 013 0V10m0-4.5v6a1.5 1.5 0 003 0V8m0-2.5v8a1.5 1.5 0 003 0V6.5M7 14h10a2 2 0 012 2v1a2 2 0 01-2 2H7a2 2 0 01-2-2v-1a2 2 0 012-2z"
      />
    </svg>
  );
}

function EmojiIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export function CommunityCallOverlay({
  callState,
  durationLabel,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleMinimize,
  onToggleRaiseHand,
  onSendEmoji,
  onEndCall
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const statusLabel = getCallStatusLabel(callState.phase, durationLabel);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el && callState.remoteStream) {
      el.srcObject = callState.remoteStream;
      void el.play().catch(() => undefined);
    }
  }, [callState.remoteStream]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && callState.localStream) {
      el.srcObject = callState.localStream;
      void el.play().catch(() => undefined);
    }
  }, [callState.localStream]);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (el && callState.remoteStream) {
      el.srcObject = callState.remoteStream;
      void el.play().catch(() => undefined);
    }
  }, [callState.remoteStream, callState.callType]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      // unsupported
    }
  }, []);

  if (!callState.isInCall || !callState.callWith) return null;

  const isVideo = callState.callType === "video";
  const peer = callState.callWith;

  const controlBtn =
    "rounded-full p-3.5 transition-colors sm:p-4 disabled:opacity-40";
  const controlNeutral = `${controlBtn} bg-slate-800 text-white hover:bg-slate-700`;
  const controlActive = `${controlBtn} bg-violet-600 text-white`;

  const reactions = (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex flex-col items-center gap-2 px-4">
      {callState.reactions.map((r) => (
        <span
          key={r.id}
          className={`animate-bounce text-4xl drop-shadow-lg sm:text-5xl ${
            r.fromSelf ? "self-end" : "self-start"
          }`}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );

  const header = (
    <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-white">{peer.name}</h3>
        <p className="text-xs text-slate-400">
          {callState.callType === "video" ? "Video" : "Voice"} · {statusLabel}
          {callState.isScreenSharing ? " · Sharing screen" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {callState.peerHandRaised && (
          <span className="mr-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            ✋ Raised
          </span>
        )}
        {callState.localHandRaised && (
          <span className="mr-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-300">
            Your hand
          </span>
        )}
        <button
          type="button"
          title={callState.isMinimized ? "Expand call" : "Minimize"}
          onClick={onToggleMinimize}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <MinimizeIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => void toggleFullscreen()}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <FullscreenIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  const controls = (
    <div className="relative flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-slate-800 px-3 py-4 sm:gap-3 sm:px-4 sm:py-5">
      <div className="relative">
        <button
          type="button"
          onClick={() => setEmojiOpen((o) => !o)}
          title="Send reaction"
          className={emojiOpen ? controlActive : controlNeutral}
        >
          <EmojiIcon />
        </button>
        <CommunityEmojiPicker
          open={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onPick={onSendEmoji}
          className="absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2"
        />
      </div>

      <button
        type="button"
        onClick={onToggleRaiseHand}
        title={callState.localHandRaised ? "Lower hand" : "Raise hand"}
        className={callState.localHandRaised ? controlActive : controlNeutral}
      >
        <RaiseHandIcon />
      </button>

      <button
        type="button"
        onClick={onToggleMute}
        title={callState.isMuted ? "Unmute microphone" : "Mute microphone"}
        className={callState.isMuted ? `${controlBtn} bg-red-600 text-white` : controlNeutral}
      >
        {callState.isMuted ? <MicOffIcon /> : <MicIcon />}
      </button>

      {isVideo && (
        <>
          <button
            type="button"
            onClick={onToggleVideo}
            disabled={callState.isScreenSharing}
            title={callState.isVideoOn ? "Turn camera off" : "Turn camera on"}
            className={
              callState.isVideoOn && !callState.isScreenSharing
                ? controlNeutral
                : `${controlBtn} bg-red-600 text-white`
            }
          >
            {callState.isVideoOn && !callState.isScreenSharing ? (
              <VideoCamIcon />
            ) : (
              <VideoCamOffIcon />
            )}
          </button>
          <button
            type="button"
            onClick={onToggleScreenShare}
            title={callState.isScreenSharing ? "Stop sharing" : "Share screen"}
            className={callState.isScreenSharing ? controlActive : controlNeutral}
          >
            {callState.isScreenSharing ? <ScreenShareStopIcon /> : <ScreenShareIcon />}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onEndCall}
        title="Hang up"
        className={`${controlBtn} bg-red-600 text-white hover:bg-red-500`}
      >
        <HangupIcon />
      </button>
    </div>
  );

  const mediaArea = (
    <div className="relative min-h-0 flex-1 bg-black">
      {isVideo ? (
        <>
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-contain" />
          {callState.phase !== "active" && !callState.remoteStream?.getTracks().length && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              {statusLabel}
            </div>
          )}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 z-10 h-24 w-36 rounded-xl border border-slate-600/80 object-cover shadow-lg sm:h-36 sm:w-52"
          />
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/50 to-sky-600/40 text-4xl font-semibold text-white">
            {initialsFromLabel(peer.name)}
          </div>
          <p className="text-lg text-slate-300">{statusLabel}</p>
        </div>
      )}
      {reactions}
    </div>
  );

  if (callState.isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[90] w-[min(100%,320px)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <div className="flex w-full items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-90"
            onClick={onToggleMinimize}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/40 text-sm font-semibold text-white">
              {initialsFromLabel(peer.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{peer.name}</p>
              <p className="text-xs text-emerald-400">{statusLabel}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={onEndCall}
            className="rounded-full bg-red-600 p-2 text-white hover:bg-red-500"
            title="Hang up"
          >
            <HangupIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="fixed inset-0 z-[90] flex flex-col bg-slate-950">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {header}
      {mediaArea}
      {controls}
    </div>
  );
}
