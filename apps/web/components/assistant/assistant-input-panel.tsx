"use client";

import { useCallback, useRef, useState } from "react";

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

function describeMicError(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Microphone needs HTTPS. Open the site via its https:// address.";
  }
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone blocked. Allow mic access for this site in your browser (padlock icon → Site settings → Microphone).";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone found. Plug one in or check your input device.";
    case "NotReadableError":
      return "Microphone is busy in another app. Close it and try again.";
    default:
      return "Could not start recording. Check browser microphone permissions and try again.";
  }
}

type AssistantInputPanelProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onVoiceResult: (blob: Blob, mimeType: string) => void;
  /** Optional: upload a pre-recorded audio file (voice note, meeting clip, etc.). */
  onAudioFile?: (file: File) => void;
  loading?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

export function AssistantInputPanel({
  value,
  onChange,
  onSubmit,
  onVoiceResult,
  onAudioFile,
  loading = false,
  placeholder = "Speak or type your request…",
  submitLabel = "Send"
}: AssistantInputPanelProps) {
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = async () => {
    if (loading || recording) return;
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError(describeMicError(null));
      return;
    }
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
    } catch (err) {
      stopStream();
      setMicError(describeMicError(err));
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const handleFilePick = (files: FileList | null) => {
    const file = files?.[0];
    if (file && onAudioFile) {
      setMicError(null);
      onAudioFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        {onAudioFile ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/webm,.m4a,.mp3,.wav,.ogg,.webm"
              className="hidden"
              onChange={(e) => handleFilePick(e.target.files)}
            />
            <button
              type="button"
              disabled={loading || recording}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-white/[0.08] bg-[#121820] px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-50"
            >
              📎 Audio file
            </button>
          </>
        ) : null}
        <span className="text-[11px] text-slate-500">⌘/Ctrl + Enter to send</span>
      </div>
      {micError ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {micError}
        </p>
      ) : null}
    </div>
  );
}
