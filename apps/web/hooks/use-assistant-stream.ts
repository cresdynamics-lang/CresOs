"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "../app/auth-context";

export type StreamPhase =
  | "idle"
  | "queued"
  | "analyzing"
  | "ledger"
  | "knowledge"
  | "thinking"
  | "writing"
  | "done"
  | "error";

export type AssistantStreamState = {
  phase: StreamPhase;
  statusMessage: string;
  reply: string;
  loading: boolean;
  error: string | null;
  donePayload: Record<string, unknown> | null;
};

const INITIAL: AssistantStreamState = {
  phase: "idle",
  statusMessage: "",
  reply: "",
  loading: false,
  error: null,
  donePayload: null
};

function parseSseChunk(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: { event: string; data: string }[] = [];
  for (const block of parts) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest };
}

/**
 * Client microservice for POST SSE assistant streams.
 * Shows analyzing phases while tokens append word-by-word.
 */
export function useAssistantStream() {
  const { apiFetch } = useAuth();
  const [state, setState] = useState<AssistantStreamState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const start = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setState({
        phase: "queued",
        statusMessage: "Starting…",
        reply: "",
        loading: true,
        error: null,
        donePayload: null
      });

      try {
        const res = await apiFetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(body),
          signal: ac.signal
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          const message = errBody.error ?? `Stream failed (${res.status})`;
          setState((s) => ({
            ...s,
            loading: false,
            phase: "error",
            error: message
          }));
          return { reply: "", donePayload: null, error: message };
        }

        const reader = res.body?.getReader();
        if (!reader) {
          const message = "No stream body from server";
          setState((s) => ({
            ...s,
            loading: false,
            phase: "error",
            error: message
          }));
          return { reply: "", donePayload: null, error: message };
        }

        let streamError: string | null = null;
        const decoder = new TextDecoder();
        let buffer = "";
        let assembled = "";
        let donePayload: Record<string, unknown> | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseChunk(buffer);
          buffer = parsed.rest;

          for (const ev of parsed.events) {
            let data: Record<string, unknown> = {};
            try {
              data = JSON.parse(ev.data) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (ev.event === "status") {
              const phase = (data.phase as StreamPhase) || "analyzing";
              const message = typeof data.message === "string" ? data.message : "";
              setState((s) => ({
                ...s,
                phase,
                statusMessage: message,
                loading: true
              }));
            } else if (ev.event === "token") {
              const text = typeof data.text === "string" ? data.text : "";
              assembled += text;
              setState((s) => ({
                ...s,
                phase: "writing",
                statusMessage: s.statusMessage || "Writing…",
                reply: assembled,
                loading: true
              }));
            } else if (ev.event === "done") {
              donePayload = data;
              if (typeof data.reply === "string" && data.reply && !assembled) {
                assembled = data.reply;
              }
              setState((s) => ({
                ...s,
                phase: "done",
                statusMessage: "Complete",
                reply: assembled || (typeof data.reply === "string" ? data.reply : s.reply),
                donePayload: data,
                loading: false
              }));
            } else if (ev.event === "error") {
              const message = typeof data.message === "string" ? data.message : "Stream error";
              streamError = message;
              setState((s) => ({
                ...s,
                phase: "error",
                error: message,
                loading: false
              }));
            }
          }
        }

        setState((s) =>
          s.loading
            ? {
                ...s,
                loading: false,
                phase: s.phase === "error" ? "error" : "done",
                statusMessage: s.phase === "error" ? s.statusMessage : "Complete"
              }
            : s
        );

        return { reply: assembled, donePayload, error: streamError };
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          return { reply: "", donePayload: null, error: "aborted" };
        }
        const message = e instanceof Error ? e.message : "Could not reach the server";
        setState((s) => ({
          ...s,
          loading: false,
          phase: "error",
          error: message
        }));
        return { reply: "", donePayload: null, error: message };
      }
    },
    [apiFetch]
  );

  return { ...state, start, reset };
}
