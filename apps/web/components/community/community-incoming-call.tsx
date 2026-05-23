"use client";

import type { IncomingCall } from "../../hooks/use-community-calls";
import { VideoCamIcon } from "./call-icons";

type Props = {
  incoming: IncomingCall;
  onAccept: () => void;
  onReject: () => void;
};

export function CommunityIncomingCall({ incoming, onAccept, onReject }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-500/40 bg-slate-900 p-6 shadow-2xl shadow-emerald-950/30">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-emerald-400 animate-pulse">
          Ringing…
        </p>
        <div className="mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600/40 to-violet-600/30 ring-4 ring-emerald-500/50 ring-offset-4 ring-offset-slate-900 animate-[pulse_1.2s_ease-in-out_infinite]">
          <span className="text-3xl font-semibold text-white">
            {incoming.callerName.trim().charAt(0).toUpperCase() || "?"}
          </span>
        </div>
        <h2 className="mt-4 text-center text-xl font-semibold text-white">{incoming.callerName}</h2>
        <p className="mt-1 text-center text-sm text-slate-400">
          Incoming {incoming.callType === "video" ? "video" : "voice"} call
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <button
            type="button"
            onClick={onReject}
            className="rounded-full bg-red-600 px-8 py-3 text-sm font-semibold text-white hover:bg-red-500"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:from-emerald-500 hover:to-teal-500"
          >
            {incoming.callType === "video" ? <VideoCamIcon /> : null}
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
