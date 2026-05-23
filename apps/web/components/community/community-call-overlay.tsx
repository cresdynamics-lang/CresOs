"use client";

import { useEffect, useRef } from "react";
import type { ActiveCallState } from "../../hooks/use-community-calls";
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
  onEndCall: () => void;
};

export function CommunityCallOverlay({
  callState,
  durationLabel,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall
}: Props) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

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

  if (!callState.isInCall || !callState.callWith) return null;

  const isVideo = callState.callType === "video";
  const connected =
    callState.connectionState === "connected" || callState.remoteStream?.getTracks().length;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-slate-950">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h3 className="font-semibold text-white">{callState.callWith.name}</h3>
          <p className="text-xs text-slate-400 capitalize">
            {callState.callType} · {connected ? durationLabel : "Connecting…"}
            {callState.isScreenSharing ? " · You are sharing screen" : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            connected ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
          }`}
        >
          {callState.connectionState}
        </span>
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        {isVideo ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-contain"
            />
            {!callState.remoteStream?.getTracks().length && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                Waiting for video…
              </div>
            )}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 z-10 h-28 w-40 rounded-xl border border-slate-600/80 object-cover shadow-lg sm:h-36 sm:w-52"
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/50 to-sky-600/40 text-4xl font-semibold text-white">
              {initialsFromLabel(callState.callWith.name)}
            </div>
            <p className="text-slate-400">{connected ? "Connected" : "Ringing…"}</p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-slate-800 px-4 py-5 sm:gap-4">
        <button
          type="button"
          onClick={onToggleMute}
          title={callState.isMuted ? "Unmute" : "Mute"}
          className={`rounded-full p-4 transition-colors ${
            callState.isMuted ? "bg-red-600 text-white" : "bg-slate-800 text-white hover:bg-slate-700"
          }`}
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
              className={`rounded-full p-4 transition-colors ${
                callState.isVideoOn && !callState.isScreenSharing
                  ? "bg-slate-800 text-white hover:bg-slate-700"
                  : "bg-red-600 text-white"
              } disabled:opacity-40`}
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
              className={`rounded-full p-4 transition-colors ${
                callState.isScreenSharing
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-white hover:bg-slate-700"
              }`}
            >
              {callState.isScreenSharing ? <ScreenShareStopIcon /> : <ScreenShareIcon />}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onEndCall}
          title="End call"
          className="rounded-full bg-red-600 p-4 text-white hover:bg-red-500"
        >
          <HangupIcon />
        </button>
      </div>
    </div>
  );
}
