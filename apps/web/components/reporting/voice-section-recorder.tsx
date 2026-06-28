"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "../../app/auth-context";

type VoiceSectionRecorderProps = {
  sectionKey: string;
  sectionLabel: string;
  existingText: string;
  onSectionText: (text: string) => void;
  disabled?: boolean;
  variant?: "developer" | "crm";
};

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

export function VoiceSectionRecorder({
  sectionKey,
  sectionLabel,
  existingText,
  onSectionText,
  disabled = false,
  variant = "developer"
}: VoiceSectionRecorderProps) {
  const { apiFetch } = useAuth();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob, mimeType: string) => {
      setProcessing(true);
      setError(null);
      try {
        const formData = new FormData();
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        formData.append("audio", blob, `section-${sectionKey}.${ext}`);
        formData.append("sectionKey", sectionKey);
        formData.append("sectionLabel", sectionLabel);
        if (existingText.trim()) {
          formData.append("existingText", existingText.trim());
        }

        const res = await apiFetch("/developer-reports/voice-section", {
          method: "POST",
          body: formData
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          sectionText?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Voice transcription failed");
          return;
        }
        if (data.sectionText) {
          onSectionText(data.sectionText);
        }
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      } finally {
        setProcessing(false);
      }
    },
    [apiFetch, existingText, onSectionText, sectionKey, sectionLabel]
  );

  const startRecording = useCallback(async () => {
    if (disabled || processing || recording) return;
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        stopStream();
        void uploadRecording(blob, type);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      stopStream();
      setError("Microphone permission denied or unavailable.");
    }
  }, [disabled, processing, recording, stopStream, uploadRecording]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const isDeveloper = variant === "developer";
  const recordBtnClass = recording
    ? isDeveloper
      ? "border-rose-500/50 bg-rose-950/40 text-rose-200"
      : "border-rose-500/50 bg-rose-950/40 text-rose-200"
    : isDeveloper
      ? "border-violet-500/40 bg-violet-950/30 text-violet-100 hover:border-violet-400/60"
      : "border-violet-500/40 bg-violet-950/30 text-violet-100 hover:border-violet-400/60";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={disabled || processing}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${recordBtnClass}`}
          >
            <span aria-hidden className="text-base">
              🎙
            </span>
            {processing ? "Transcribing…" : "Activate voice"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${recordBtnClass}`}
          >
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            Stop & transcribe
          </button>
        )}
        {processing ? (
          <span className="text-xs text-slate-400">AI is converting your voice to text…</span>
        ) : recording ? (
          <span className="text-xs text-rose-300/90">Recording — speak naturally, then stop.</span>
        ) : (
          <span className="text-xs text-slate-500">Record this section; AI fills the field below.</span>
        )}
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
