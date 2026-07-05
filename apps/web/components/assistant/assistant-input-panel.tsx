"use client";

import { useCallback, useRef, useState } from "react";

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

type AssistantInputPanelProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onVoiceResult: (blob: Blob, mimeType: string) => void;
  loading?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

export function AssistantInputPanel({
  value,
  onChange,
  onSubmit,
  onVoiceResult,
  loading = false,
  placeholder = "Speak or type your request…",
  submitLabel = "Send"
}: AssistantInputPanelProps) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = async () => {
    if (loading || recording) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMime();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stopStream();
        if (blob.size > 0) onVoiceResult(blob, type);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      stopStream();
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  return (
    <div className="space-y-3">
      <textarea
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={loading || recording}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#0e1319] px-3 py-3 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 disabled:opacity-60"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void onSubmit()}
          className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Thinking…" : submitLabel}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => (recording ? stopRecording() : void startRecording())}
          className={`rounded-xl border px-4 py-2 text-sm font-medium ${
            recording
              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
              : "border-white/[0.08] bg-[#121820] text-slate-200"
          }`}
        >
          {recording ? "Stop recording" : "🎤 Voice"}
        </button>
        <span className="text-[11px] text-slate-500">⌘/Ctrl + Enter to send</span>
      </div>
    </div>
  );
}
