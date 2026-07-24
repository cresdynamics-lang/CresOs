import type { Response } from "express";

export type AssistantStreamStatusPhase =
  | "queued"
  | "analyzing"
  | "ledger"
  | "knowledge"
  | "thinking"
  | "writing"
  | "done"
  | "error";

/** Shared SSE writer microservice — keeps stream transport independent of domain logic. */
export function createAssistantSseWriter(res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const write = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  return {
    status(phase: AssistantStreamStatusPhase, message: string, extra?: Record<string, unknown>) {
      write("status", { phase, message, ...extra });
    },
    token(text: string) {
      write("token", { text });
    },
    done(payload: Record<string, unknown>) {
      write("done", payload);
    },
    error(message: string) {
      write("error", { message });
    },
    end() {
      res.end();
    }
  };
}

export type AssistantSseWriter = ReturnType<typeof createAssistantSseWriter>;
