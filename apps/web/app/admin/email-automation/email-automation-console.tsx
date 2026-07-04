"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth-context";
import { adminNeu } from "../../../components/admin/admin-theme";
import { AdminPanel } from "../../../components/admin/admin-ui";
import { EmailTemplateStudio } from "../../../components/email-ai/email-template-studio";
import {
  STATUS_FILTERS,
  STATUS_LABELS,
  STATUS_TONE,
  fmtDate,
  fmtDateShort,
  initials,
  type EmailStats,
  type EmailStatus,
  type ThreadDetail,
  type ThreadSummary
} from "../../../components/email-ai/email-ai-types";

const LIMIT = 30;

function EmailMessageCard({
  label,
  from,
  email,
  date,
  subject,
  body,
  variant = "inbound"
}: {
  label: string;
  from: string;
  email: string;
  date: string;
  subject: string;
  body: string;
  variant?: "inbound" | "draft";
}) {
  const isDraft = variant === "draft";
  return (
    <article
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        isDraft
          ? "border-indigo-500/25 bg-gradient-to-b from-indigo-500/[0.06] to-[#121820]"
          : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      <header className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            isDraft ? "bg-indigo-500/20 text-indigo-200" : "bg-slate-700/80 text-slate-200"
          }`}
        >
          {initials(from, email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{from || email}</p>
              <p className="truncate text-xs text-slate-500">{email}</p>
            </div>
            <time className="shrink-0 text-[11px] text-slate-500">{fmtDate(date)}</time>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-200">{subject}</p>
        </div>
      </header>
      <div className="px-4 py-4 sm:px-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{body || "(empty)"}</div>
      </div>
    </article>
  );
}

export function EmailAutomationConsole() {
  const { apiFetch } = useAuth();

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [stats, setStats] = useState<EmailStats | null>(null);
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [configInstructions, setConfigInstructions] = useState("");
  const [configEnabled, setConfigEnabled] = useState(true);
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
      if (res.ok) setStats((await res.json()) as EmailStats);
    } catch {
      /* ignore */
    }
  }, [apiFetch]);

  const loadThreads = useCallback(
    async (newOffset = 0, statusOverride?: string) => {
      const status = statusOverride !== undefined ? statusOverride : statusFilter;
      setListLoading(true);
      try {
        const qs = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(newOffset),
          ...(status ? { status } : {})
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
    },
    [apiFetch, statusFilter]
  );

  useEffect(() => {
    void loadStats();
    void loadThreads(0);
  }, [loadStats, loadThreads]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await apiFetch("/email-automation/config");
      if (res.ok) {
        const d = (await res.json()) as {
          instructions: string;
          ceoDefaultInstructions: string;
          isEnabled: boolean;
        };
        setConfigInstructions(d.instructions);
        setCeoDefault(d.ceoDefaultInstructions);
        setConfigEnabled(d.isEnabled ?? true);
      }
    } finally {
      setConfigLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (showConfig) void loadConfig();
  }, [showConfig, loadConfig]);

  const openThread = useCallback(
    async (id: string) => {
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
    },
    [apiFetch]
  );

  const clearAction = () => {
    setActionError(null);
    setActionSuccess(null);
  };

  const doApprove = useCallback(async () => {
    if (!selected) return;
    clearAction();
    setActionBusy(true);
    try {
      const res = await apiFetch(`/email-automation/threads/${selected.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingDraft ? { draftReply: draftText } : {})
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setActionSuccess("Reply sent successfully.");
        setEditingDraft(false);
        setSelected((p) => (p ? { ...p, status: "sent" } : p));
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
        setSelected((p) => (p ? { ...p, status: "ignored" } : p));
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
        body: JSON.stringify({ revisionNotes: revisionNotes || null })
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

  const doRetry = useCallback(async () => {
    if (!selected) return;
    clearAction();
    setActionBusy(true);
    try {
      const res = await apiFetch(`/email-automation/threads/${selected.id}/retry`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as ThreadDetail & { error?: string };
      if (res.ok) {
        setSelected({ ...selected, ...data });
        setDraftText(data.draftReply || "");
        setActionSuccess("Draft generated successfully.");
        await loadThreads(offset);
        await loadStats();
      } else {
        setActionError(data.error ?? "Retry failed");
        if (data.draftError) setSelected((p) => (p ? { ...p, draftError: data.draftError, status: "failed" } : p));
      }
    } finally {
      setActionBusy(false);
    }
  }, [selected, apiFetch, loadThreads, offset, loadStats]);

  const saveConfig = useCallback(async () => {
    setConfigSaving(true);
    try {
      await apiFetch("/email-automation/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: configInstructions, isEnabled: configEnabled })
      });
      setActionSuccess("Email AI settings saved.");
    } finally {
      setConfigSaving(false);
    }
  }, [apiFetch, configInstructions, configEnabled]);

  const doPoll = useCallback(async () => {
    setPolling(true);
    setPollMsg(null);
    try {
      const res = await apiFetch("/email-automation/poll", { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; newEmails?: number; error?: string };
      setPollMsg(
        res.ok && d.ok ? `${d.newEmails ?? 0} new email(s) fetched.` : (d.error ?? "Poll failed")
      );
      if (res.ok && d.ok) {
        await loadThreads(0);
        await loadStats();
      }
    } finally {
      setPolling(false);
    }
  }, [apiFetch, loadThreads, loadStats]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.fromEmail.toLowerCase().includes(q) ||
        (t.fromName || "").toLowerCase().includes(q)
    );
  }, [threads, search]);

  const canAct = selected && ["awaiting_approval", "editing", "failed"].includes(selected.status) && !actionBusy;
  const canRetryDraft =
    selected &&
    (selected.status === "failed" || (selected.status === "pending_draft" && !selected.draftReply)) &&
    !actionBusy;

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4">
      <AdminPanel className="!p-4 sm:!p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">Command · Email AI</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-100 sm:text-2xl">Inbox &amp; automated replies</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Inbound mail is drafted by AI using the email body plus extracted PDF/Word/text attachments, then reviewed here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pollMsg ? (
              <span
                className={`text-xs ${pollMsg.toLowerCase().includes("fail") ? "text-rose-400" : "text-emerald-400"}`}
              >
                {pollMsg}
              </span>
            ) : null}
            <button type="button" onClick={() => void doPoll()} disabled={polling} className={adminNeu.btnGhost}>
              {polling ? "Checking…" : "Check inbox"}
            </button>
            <button type="button" onClick={() => setShowTemplates(true)} className={adminNeu.btnGhost}>
              Template studio
            </button>
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              className={showConfig ? adminNeu.navActive + " px-3 py-2 text-sm" : adminNeu.btnGhost}
            >
              AI instructions
            </button>
          </div>
        </div>

        {showConfig ? (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#0e1319] p-4">
            <p className="text-sm font-medium text-slate-200">Email AI settings</p>
            <p className="mt-1 text-xs text-slate-500">
              Enable automation and optionally override CEO / Director tone defaults for all inbound drafts.
            </p>
            {configLoading ? (
              <p className="mt-3 text-xs text-slate-500">Loading…</p>
            ) : (
              <>
                <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={configEnabled}
                    onChange={(e) => setConfigEnabled(e.target.checked)}
                    className="rounded border-white/20 bg-[#121820]"
                  />
                  Email automation enabled (IMAP fetch + AI drafts)
                </label>
                <textarea
                  rows={5}
                  value={configInstructions}
                  onChange={(e) => setConfigInstructions(e.target.value)}
                  placeholder="Optional custom instructions…"
                  className="mt-3 w-full rounded-xl border border-white/[0.08] bg-[#121820] px-3 py-2.5 text-sm text-slate-200"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => void saveConfig()} disabled={configSaving} className={adminNeu.btnPrimary}>
                    {configSaving ? "Saving…" : "Save settings"}
                  </button>
                  <button type="button" onClick={() => setShowDefaultCeo((v) => !v)} className="text-xs text-slate-400 hover:text-slate-300">
                    {showDefaultCeo ? "Hide" : "View"} CEO default
                  </button>
                </div>
                {showDefaultCeo ? (
                  <pre className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-white/[0.06] bg-[#0b0f14] p-3 text-[11px] text-slate-400">
                    {ceoDefault}
                  </pre>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </AdminPanel>

      <div className={`${adminNeu.panel} !p-0 flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-3 sm:px-4">
          {STATUS_FILTERS.map((f) => {
            const count = stats ? stats[f.statKey] : undefined;
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key || "all"}
                type="button"
                onClick={() => {
                  setStatusFilter(f.key);
                  void loadThreads(0, f.key);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                {f.label}
                {typeof count === "number" ? (
                  <span className={`tabular-nums ${active ? "text-indigo-300" : "text-slate-500"}`}>{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-full max-w-sm shrink-0 flex-col border-r border-white/[0.06] bg-[#0e1319]/60">
            <div className="shrink-0 border-b border-white/[0.06] p-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mail…"
                className="w-full rounded-xl border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {listLoading ? (
                <p className="py-16 text-center text-xs text-slate-500">Loading inbox…</p>
              ) : filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <div className="text-3xl opacity-30">✉</div>
                  <p className="text-xs text-slate-500">No messages in this folder</p>
                </div>
              ) : (
                filteredThreads.map((t) => {
                  const active = selected?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => void openThread(t.id)}
                      className={`flex w-full gap-3 border-b border-white/[0.04] px-3 py-3 text-left transition-colors hover:bg-white/[0.03] ${
                        active ? "bg-indigo-500/[0.08] ring-1 ring-inset ring-indigo-500/20" : ""
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700/80 text-xs font-semibold text-slate-200">
                        {initials(t.fromName, t.fromEmail)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-slate-200">
                            {t.fromName || t.fromEmail}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-500">{fmtDateShort(t.receivedAt)}</span>
                        </div>
                        <p className="truncate text-xs text-slate-400">{t.subject}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${STATUS_TONE[t.status as EmailStatus]}`}
                          >
                            {STATUS_LABELS[t.status as EmailStatus]}
                          </span>
                          <span className="text-[10px] text-slate-600">
                            {t.senderType === "external" ? "Client" : "Internal"}
                          </span>
                          {t.hasAttachments ? (
                            <span className="text-[10px] text-amber-500/90">📎 Attachments</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {total > LIMIT ? (
              <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-3 py-2 text-xs text-slate-500">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => void loadThreads(Math.max(0, offset - LIMIT))}
                  className="disabled:opacity-30"
                >
                  ← Prev
                </button>
                <span>
                  {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
                </span>
                <button
                  type="button"
                  disabled={offset + LIMIT >= total}
                  onClick={() => void loadThreads(offset + LIMIT)}
                  className="disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            ) : null}
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-[#0b0f14]/40">
            {detailLoading ? (
              <p className="py-24 text-center text-sm text-slate-500">Opening message…</p>
            ) : !selected ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-3xl">✉</div>
                <p className="text-sm font-medium text-slate-400">Select a message to review</p>
                <p className="max-w-sm text-xs text-slate-600">
                  AI drafts appear here for approval. Sent replies use your saved email template.
                </p>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[selected.status]}`}
                    >
                      {STATUS_LABELS[selected.status]}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      {selected.senderType === "external" ? "External sender · CEO tone" : "Internal · Director tone"}
                      {selected.hasAttachments ? " · Attachments included in AI context" : ""}
                    </p>
                  </div>
                </div>

                {selected.draftError ? (
                  <div className={`${adminNeu.alertDanger} px-4 py-3 text-sm text-rose-300`}>
                    <p className="font-medium">Draft failed</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-rose-200/90">{selected.draftError}</p>
                  </div>
                ) : null}

                <EmailMessageCard
                  label="Received"
                  from={selected.fromName}
                  email={selected.fromEmail}
                  date={selected.receivedAt}
                  subject={selected.subject}
                  body={selected.body}
                  variant="inbound"
                />

                {editingDraft ? (
                  <div className="overflow-hidden rounded-2xl border border-indigo-500/25 bg-[#121820]">
                    <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
                      <p className="text-sm font-semibold text-indigo-200">Edit reply draft</p>
                    </div>
                    <textarea
                      rows={12}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      className="w-full resize-y bg-transparent px-4 py-4 text-sm leading-relaxed text-slate-200 focus:outline-none sm:px-5"
                    />
                  </div>
                ) : (
                  <EmailMessageCard
                    label="AI draft reply"
                    from="Cres Dynamics"
                    email="reply@cresdynamics.com"
                    date={selected.updatedAt}
                    subject={`Re: ${selected.subject}`}
                    body={selected.draftReply || "(Draft not ready yet — pipeline may still be running)"}
                    variant="draft"
                  />
                )}

                {selected.waMessageSid && ["awaiting_approval", "editing"].includes(selected.status) ? (
                  <div className={`${adminNeu.alertInfo} flex items-center gap-3 px-4 py-3 text-sm text-indigo-200`}>
                    <span>📱</span>
                    <span className="flex-1">Draft on WhatsApp — reply APPROVE, IGNORE, or edit then SUBMIT.</span>
                    <button
                      type="button"
                      onClick={() => void doResendWhatsApp()}
                      disabled={waResending}
                      className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      {waResending ? "Sending…" : "Resend"}
                    </button>
                  </div>
                ) : null}

                {actionError ? (
                  <div className={`${adminNeu.alertDanger} px-4 py-3 text-sm text-rose-300`}>{actionError}</div>
                ) : null}
                {actionSuccess ? (
                  <div className={`${adminNeu.alertInfo} px-4 py-3 text-sm text-emerald-300`}>{actionSuccess}</div>
                ) : null}

                {canRetryDraft ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void doRetry()} disabled={actionBusy} className={adminNeu.btnPrimary}>
                      {actionBusy ? "Generating…" : "Retry AI draft"}
                    </button>
                    <button type="button" onClick={() => void doRegenerate()} disabled={actionBusy} className={adminNeu.btnGhost}>
                      Regenerate with notes
                    </button>
                  </div>
                ) : null}

                {["awaiting_approval", "editing", "failed"].includes(selected.status) ? (
                  <div className="flex flex-wrap gap-2">
                    {canAct && !editingDraft && selected.draftReply ? (
                      <button type="button" onClick={() => setEditingDraft(true)} className={adminNeu.btnGhost}>
                        Edit draft
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void doApprove()}
                      disabled={actionBusy || !selected.draftReply}
                      className={adminNeu.btnPrimary}
                    >
                      {actionBusy ? "Sending…" : editingDraft ? "Save & send" : "Approve & send"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRevise((v) => !v)}
                      disabled={actionBusy}
                      className={adminNeu.btnGhost}
                    >
                      Regenerate
                    </button>
                    <button type="button" onClick={() => void doIgnore()} disabled={actionBusy} className={adminNeu.btnGhost}>
                      Ignore
                    </button>
                    {!selected.waMessageSid ? (
                      <button
                        type="button"
                        onClick={() => void doResendWhatsApp()}
                        disabled={waResending || !selected.draftReply}
                        className={adminNeu.btnGhost}
                      >
                        Send to WhatsApp
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {showRevise ? (
                  <div className="rounded-xl border border-white/[0.06] bg-[#0e1319] p-4">
                    <p className="text-xs font-medium text-slate-400">Revision notes for the AI (optional)</p>
                    <textarea
                      rows={3}
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      placeholder="E.g. Shorter, mention our 3-day turnaround…"
                      className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                    />
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => void doRegenerate()} disabled={actionBusy} className={adminNeu.btnPrimary}>
                        {actionBusy ? "Generating…" : "Generate new draft"}
                      </button>
                      <button type="button" onClick={() => setShowRevise(false)} className={adminNeu.btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {selected.status === "sent" ? (
                  <div className={`${adminNeu.alertInfo} px-4 py-3 text-sm text-emerald-300`}>
                    Reply sent to {selected.fromEmail}
                  </div>
                ) : null}
                {selected.status === "ignored" ? (
                  <p className="text-sm text-slate-500">This message was ignored.</p>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </div>

      <EmailTemplateStudio apiFetch={apiFetch} open={showTemplates} onClose={() => setShowTemplates(false)} />
    </div>
  );
}
