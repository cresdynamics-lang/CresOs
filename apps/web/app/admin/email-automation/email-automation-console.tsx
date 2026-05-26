"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth-context";

// ── Types ─────────────────────────────────────────────────────────────────────

type EmailStatus =
  | "pending_draft"
  | "awaiting_approval"
  | "editing"
  | "approved"
  | "sent"
  | "failed"
  | "ignored";

type SenderType = "external" | "internal";

type ThreadSummary = {
  id: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  status: EmailStatus;
  senderType: SenderType;
  receivedAt: string;
  updatedAt: string;
  draftReply: string | null;
  waMessageSid: string | null;
};

type ThreadDetail = ThreadSummary & {
  body: string;
  revisionNotes: string | null;
  messageId: string;
};

type Stats = { total: number; pending: number; sent: number; failed: number; ignored: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<EmailStatus, string> = {
  pending_draft: "Drafting",
  awaiting_approval: "Awaiting Review",
  editing: "Editing",
  approved: "Approved",
  sent: "Sent",
  failed: "Failed",
  ignored: "Ignored",
};

const STATUS_COLORS: Record<EmailStatus, string> = {
  pending_draft: "bg-slate-700 text-slate-300",
  awaiting_approval: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  editing: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  approved: "bg-teal-500/20 text-teal-300 border border-teal-500/30",
  sent: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  failed: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  ignored: "bg-slate-800 text-slate-500",
};

const SENDER_COLORS: Record<SenderType, string> = {
  external: "bg-violet-500/15 text-violet-300 border border-violet-500/25",
  internal: "bg-slate-700/60 text-slate-400 border border-slate-600/40",
};

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "awaiting_approval", label: "Awaiting Review" },
  { key: "editing", label: "Editing" },
  { key: "pending_draft", label: "Drafting" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "ignored", label: "Ignored" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1) return `${Math.round(diffMs / 60000)}m ago`;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "amber" | "emerald" | "rose" | "slate";
}) {
  const numClass =
    tone === "amber"
      ? "text-amber-300"
      : tone === "emerald"
        ? "text-emerald-300"
        : tone === "rose"
          ? "text-rose-300"
          : tone === "slate"
            ? "text-slate-500"
            : "text-slate-100";
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <span className={`text-2xl font-bold leading-none tabular-nums ${numClass}`}>{value}</span>
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EmailAutomationConsole() {
  const { apiFetch } = useAuth();

  const [statusFilter, setStatusFilter] = useState("");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;
  const [listLoading, setListLoading] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);

  const [selected, setSelected] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [editingDraft, setEditingDraft] = useState(false);
  const [draftText, setDraftText] = useState("");

  const [showRevise, setShowRevise] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  const [showConfig, setShowConfig] = useState(false);
  const [configInstructions, setConfigInstructions] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [showDefaultCeo, setShowDefaultCeo] = useState(false);
  const [ceoDefault, setCeoDefault] = useState("");

  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState<string | null>(null);
  const [waResending, setWaResending] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiFetch("/email-automation/stats");
      if (res.ok) setStats((await res.json()) as Stats);
    } catch { /* ignore */ }
  }, [apiFetch]);

  const loadThreads = useCallback(async (newOffset = 0) => {
    setListLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(newOffset),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const res = await apiFetch(`/email-automation/threads?${qs}`);
      if (res.ok) {
        const d = (await res.json()) as { threads: ThreadSummary[]; total: number };
        setThreads(d.threads);
        setTotal(d.total);
        setOffset(newOffset);
      }
    } finally {
      setListLoading(false);
    }
  }, [apiFetch, statusFilter]);

  useEffect(() => { loadStats(); loadThreads(0); }, [loadStats, loadThreads]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await apiFetch("/email-automation/config");
      if (res.ok) {
        const d = (await res.json()) as {
          instructions: string;
          ceoDefaultInstructions: string;
          directorDefaultInstructions: string;
        };
        setConfigInstructions(d.instructions);
        setCeoDefault(d.ceoDefaultInstructions);
      }
    } finally {
      setConfigLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { if (showConfig) loadConfig(); }, [showConfig, loadConfig]);

  const openThread = useCallback(async (id: string) => {
    setDetailLoading(true);
    setActionError(null);
    setActionSuccess(null);
    setEditingDraft(false);
    setShowRevise(false);
    setRevisionNotes("");
    setWaResending(false);
    try {
      const res = await apiFetch(`/email-automation/threads/${id}`);
      if (res.ok) {
        const t = (await res.json()) as ThreadDetail;
        setSelected(t);
        setDraftText(t.draftReply || "");
      }
    } finally {
      setDetailLoading(false);
    }
  }, [apiFetch]);

  const clearAction = () => { setActionError(null); setActionSuccess(null); };

  const doApprove = useCallback(async () => {
    if (!selected) return;
    clearAction();
    setActionBusy(true);
    try {
      const res = await apiFetch(`/email-automation/threads/${selected.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingDraft ? { draftReply: draftText } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setActionSuccess("Reply sent successfully.");
        setEditingDraft(false);
        setSelected((p) => p ? { ...p, status: "sent" } : p);
        await loadThreads(offset);
        await loadStats();
      } else {
        setActionError(data.error ?? "Failed to send reply");
      }
    } finally {
      setActionBusy(false);
    }
  }, [selected, editingDraft, draftText, apiFetch, loadThreads, offset, loadStats]);

  const doIgnore = useCallback(async () => {
    if (!selected) return;
    clearAction();
    setActionBusy(true);
    try {
      const res = await apiFetch(`/email-automation/threads/${selected.id}/ignore`, { method: "POST" });
      if (res.ok) {
        setActionSuccess("Email ignored.");
        setSelected((p) => p ? { ...p, status: "ignored" } : p);
        await loadThreads(offset);
        await loadStats();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(d.error ?? "Failed to ignore");
      }
    } finally {
      setActionBusy(false);
    }
  }, [selected, apiFetch, loadThreads, offset, loadStats]);

  const doRegenerate = useCallback(async () => {
    if (!selected) return;
    clearAction();
    setActionBusy(true);
    setShowRevise(false);
    try {
      const res = await apiFetch(`/email-automation/threads/${selected.id}/regenerate-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionNotes: revisionNotes || null }),
      });
      const data = (await res.json().catch(() => ({}))) as ThreadDetail & { error?: string };
      if (res.ok) {
        setSelected({ ...selected, ...data });
        setDraftText(data.draftReply || "");
        setRevisionNotes("");
        setActionSuccess("New draft generated.");
        await loadThreads(offset);
      } else {
        setActionError(data.error ?? "Draft generation failed");
      }
    } finally {
      setActionBusy(false);
    }
  }, [selected, revisionNotes, apiFetch, loadThreads, offset]);

  const doResendWhatsApp = useCallback(async () => {
    if (!selected) return;
    setWaResending(true);
    clearAction();
    try {
      const res = await apiFetch(`/email-automation/threads/${selected.id}/resend-whatsapp`, { method: "POST" });
      if (res.ok) {
        setActionSuccess("Draft re-sent to WhatsApp.");
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(d.error ?? "Failed to resend to WhatsApp");
      }
    } finally {
      setWaResending(false);
    }
  }, [selected, apiFetch]);

  const saveConfig = useCallback(async () => {
    setConfigSaving(true);
    try {
      await apiFetch("/email-automation/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: configInstructions }),
      });
      setActionSuccess("Instructions saved.");
    } finally {
      setConfigSaving(false);
    }
  }, [apiFetch, configInstructions]);

  const doPoll = useCallback(async () => {
    setPolling(true);
    setPollMsg(null);
    try {
      const res = await apiFetch("/email-automation/poll", { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; newEmails?: number; error?: string };
      setPollMsg(res.ok && d.ok ? `${d.newEmails ?? 0} new email(s) fetched.` : (d.error ?? "Poll failed"));
      if (res.ok && d.ok) { await loadThreads(0); await loadStats(); }
    } finally {
      setPolling(false);
    }
  }, [apiFetch, loadThreads, loadStats]);

  const canAct = selected && ["awaiting_approval", "editing", "failed"].includes(selected.status) && !actionBusy;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">

      {/* ── Top bar ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-lg ring-1 ring-violet-500/30">
            ✉
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-100">Email Automation</h1>
            <p className="text-[11px] text-slate-500">
              IMAP inbox → AI draft (CEO / Director tone) → WhatsApp approval → Send
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pollMsg && (
            <span className={`text-xs ${pollMsg.includes("failed") || pollMsg.includes("error") ? "text-rose-400" : "text-emerald-400"}`}>
              {pollMsg}
            </span>
          )}
          <button
            onClick={doPoll}
            disabled={polling}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 disabled:opacity-50"
          >
            {polling ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-slate-200" />
                Checking…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Check Inbox
              </>
            )}
          </button>
          <button
            onClick={() => setShowConfig((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
              showConfig
                ? "border-violet-500/40 bg-violet-600/15 text-violet-300"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            AI Instructions
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      {stats && (
        <div className="flex shrink-0 gap-3 border-b border-slate-800 bg-slate-950/60 px-6 py-3">
          <StatPill label="Total" value={stats.total} tone="default" />
          <StatPill label="Awaiting Review" value={stats.pending} tone="amber" />
          <StatPill label="Sent" value={stats.sent} tone="emerald" />
          <StatPill label="Failed" value={stats.failed} tone="rose" />
          <StatPill label="Ignored" value={stats.ignored} tone="slate" />
        </div>
      )}

      {/* ── AI Config panel ── */}
      {showConfig && (
        <div className="shrink-0 border-b border-slate-800 bg-slate-900/50 px-6 py-4">
          <p className="mb-3 text-xs font-semibold text-slate-300">AI Reply Instructions</p>
          {configLoading ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">
                Leave blank to use built-in defaults (CEO tone for external senders, Director tone for internal).
                Custom text here overrides both for all emails.
              </p>
              <textarea
                rows={6}
                value={configInstructions}
                onChange={(e) => setConfigInstructions(e.target.value)}
                placeholder="Optional: custom instructions that override CEO / Director defaults…"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={saveConfig}
                  disabled={configSaving}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                >
                  {configSaving ? "Saving…" : "Save Instructions"}
                </button>
                <button
                  onClick={() => setShowDefaultCeo((v) => !v)}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  {showDefaultCeo ? "Hide" : "View"} CEO default
                </button>
              </div>
              {showDefaultCeo && (
                <pre className="max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-[11px] leading-relaxed text-slate-400">
                  {ceoDefault}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Main two-pane area ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left: thread list */}
        <div className="flex w-80 shrink-0 flex-col border-r border-slate-800 bg-slate-900/30">

          {/* Filter chips */}
          <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-800 px-3 py-3">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setStatusFilter(f.key); loadThreads(0); }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  statusFilter === f.key
                    ? "bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30"
                    : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Thread list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex items-center justify-center py-16 text-xs text-slate-500">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border border-slate-600 border-t-slate-300" />
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <div className="text-3xl opacity-30">✉</div>
                <p className="text-xs text-slate-500">
                  {statusFilter ? `No ${statusFilter.replace(/_/g, " ")} emails` : "No emails yet — click Check Inbox"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openThread(t.id)}
                    className={`flex flex-col gap-1.5 border-b border-slate-800/60 px-4 py-3.5 text-left transition-colors hover:bg-slate-800/50 ${
                      selected?.id === t.id ? "bg-violet-600/10 ring-inset ring-1 ring-violet-500/25" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">
                        {t.fromName || t.fromEmail}
                      </span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[t.status]}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-400">{t.subject}</p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${SENDER_COLORS[t.senderType]}`}>
                        {t.senderType === "external" ? "🌐 Client" : "👤 Internal"}
                      </span>
                      <span className="text-[10px] text-slate-600">{fmtDateShort(t.receivedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex shrink-0 items-center justify-between border-t border-slate-800 px-4 py-2.5 text-xs text-slate-500">
              <button
                disabled={offset === 0}
                onClick={() => loadThreads(Math.max(0, offset - LIMIT))}
                className="rounded px-2 py-1 hover:text-slate-300 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
              <button
                disabled={offset + LIMIT >= total}
                onClick={() => loadThreads(offset + LIMIT)}
                className="rounded px-2 py-1 hover:text-slate-300 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="min-w-0 flex-1 overflow-y-auto bg-slate-950/30">
          {detailLoading ? (
            <div className="flex items-center justify-center py-32 text-xs text-slate-500">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border border-slate-600 border-t-slate-300" />
            </div>
          ) : !selected ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="mb-3 text-5xl opacity-20">✉</div>
              <p className="text-sm font-medium text-slate-500">Select an email to review the AI draft</p>
              <p className="mt-1 text-xs text-slate-600">
                Incoming emails are automatically drafted by the AI
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl flex flex-col gap-0 divide-y divide-slate-800/80 p-6">

              {/* Email header */}
              <div className="pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-100">{selected.subject}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {selected.fromName ? `${selected.fromName}` : selected.fromEmail}
                      {selected.fromName && (
                        <span className="ml-1 text-slate-600">&lt;{selected.fromEmail}&gt;</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">{fmtDate(selected.receivedAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[selected.status]}`}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${SENDER_COLORS[selected.senderType]}`}>
                      {selected.senderType === "external" ? "🌐 External — CEO tone" : "👤 Internal — Director tone"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Original email */}
              <div className="py-5">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                  Original Email
                </p>
                <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-300">
                  {selected.body || "(no body)"}
                </pre>
              </div>

              {/* AI draft */}
              <div className="py-5">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                    AI Draft Reply
                    <span className="ml-2 normal-case font-normal text-slate-700">
                      ({selected.senderType === "external" ? "CEO voice" : "Director voice"})
                    </span>
                  </p>
                  {canAct && !editingDraft && selected.draftReply && (
                    <button
                      onClick={() => { setEditingDraft(true); setDraftText(selected.draftReply || ""); }}
                      className="text-xs font-medium text-violet-400 hover:text-violet-300"
                    >
                      Edit draft
                    </button>
                  )}
                  {editingDraft && (
                    <button
                      onClick={() => { setEditingDraft(false); setDraftText(selected.draftReply || ""); }}
                      className="text-xs text-slate-500 hover:text-slate-400"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {editingDraft ? (
                  <textarea
                    rows={14}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="w-full rounded-xl border border-violet-500/30 bg-slate-900/80 p-4 text-sm leading-relaxed text-slate-200 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                  />
                ) : (
                  <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-300">
                    {selected.draftReply || "(draft not yet generated — pipeline is running or failed)"}
                  </pre>
                )}
              </div>

              {/* WhatsApp status */}
              {selected.waMessageSid && ["awaiting_approval", "editing"].includes(selected.status) && (
                <div className="py-4">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-800/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
                    <span className="text-base">📱</span>
                    <span className="flex-1">Draft sent to WhatsApp — reply APPROVE, IGNORE, or type an edit.</span>
                    <button
                      onClick={doResendWhatsApp}
                      disabled={waResending}
                      className="shrink-0 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                    >
                      {waResending ? "Sending…" : "Resend"}
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {actionError && (
                <div className="py-3">
                  <div className="rounded-xl border border-rose-700/40 bg-rose-900/20 px-4 py-3 text-sm text-rose-300">
                    {actionError}
                  </div>
                </div>
              )}
              {actionSuccess && (
                <div className="py-3">
                  <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
                    {actionSuccess}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {["awaiting_approval", "editing", "failed"].includes(selected.status) && (
                <div className="pt-5">
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      onClick={doApprove}
                      disabled={actionBusy || !selected.draftReply}
                      className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {actionBusy ? "Sending…" : editingDraft ? "Save & Send" : "Approve & Send"}
                    </button>
                    <button
                      onClick={() => setShowRevise((v) => !v)}
                      disabled={actionBusy}
                      className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        showRevise
                          ? "border-violet-500/40 bg-violet-600/15 text-violet-300"
                          : "border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
                      }`}
                    >
                      Regenerate Draft
                    </button>
                    <button
                      onClick={doIgnore}
                      disabled={actionBusy}
                      className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Ignore
                    </button>
                    {!selected.waMessageSid && (
                      <button
                        onClick={doResendWhatsApp}
                        disabled={waResending || !selected.draftReply}
                        className="rounded-lg border border-emerald-700/50 px-4 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-900/30 disabled:opacity-50"
                      >
                        {waResending ? "Sending…" : "📱 Send to WhatsApp"}
                      </button>
                    )}
                  </div>

                  {/* Regenerate with revision notes */}
                  {showRevise && (
                    <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                      <p className="mb-2 text-xs font-medium text-slate-400">
                        Revision notes — tell the AI what to change (optional):
                      </p>
                      <textarea
                        rows={3}
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        placeholder="E.g. Shorten it. Mention our 3-day turnaround. Use a more direct tone."
                        className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                      />
                      <div className="mt-3 flex gap-2.5">
                        <button
                          onClick={doRegenerate}
                          disabled={actionBusy}
                          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                        >
                          {actionBusy ? "Generating…" : "Generate New Draft"}
                        </button>
                        <button
                          onClick={() => setShowRevise(false)}
                          className="text-xs text-slate-500 hover:text-slate-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Terminal states */}
              {selected.status === "sent" && (
                <div className="pt-4">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-800/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
                    <span>✓</span>
                    <span>Reply sent to {selected.fromEmail}</span>
                  </div>
                </div>
              )}
              {selected.status === "ignored" && (
                <div className="pt-4">
                  <p className="text-sm text-slate-600">This email was marked as ignored.</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
