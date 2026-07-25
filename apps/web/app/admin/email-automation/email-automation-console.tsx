"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth-context";
import { adminNeu } from "../../../components/admin/admin-theme";
import { AdminPanel } from "../../../components/admin/admin-ui";
import { EmailTemplateStudio } from "../../../components/email-ai/email-template-studio";
import {
  EMAIL_SIDEBAR_PRIMARY,
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

  const primaryFilters = STATUS_FILTERS.filter((f) =>
    (EMAIL_SIDEBAR_PRIMARY as readonly string[]).includes(f.key)
  );
  const secondaryFilters = STATUS_FILTERS.filter(
    (f) => !(EMAIL_SIDEBAR_PRIMARY as readonly string[]).includes(f.key)
  );

  const selectCategory = (key: string) => {
    setStatusFilter(key);
    setSelected(null);
    void loadThreads(0, key);
  };

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] min-h-[28rem] flex-col gap-3 overflow-hidden">
      <AdminPanel className="!shrink-0 !p-3 sm:!p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">Command · Email AI</p>
            <h1 className="mt-0.5 text-lg font-semibold text-slate-900 sm:text-xl">Inbox &amp; automated replies</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pollMsg ? (
              <span
                className={`max-w-[16rem] truncate text-xs ${
                  pollMsg.toLowerCase().includes("fail") || pollMsg.toLowerCase().includes("auth")
                    ? "text-rose-600"
                    : "text-emerald-700"
                }`}
              >
                {pollMsg}
              </span>
            ) : null}
            <button type="button" onClick={() => void doPoll()} disabled={polling} className={adminNeu.btnGhost}>
              {polling ? "Checking…" : "Check inbox"}
            </button>
            <button type="button" onClick={() => setShowTemplates(true)} className={adminNeu.btnGhost}>
              Templates
            </button>
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              className={showConfig ? `${adminNeu.navActive} px-3 py-2 text-sm` : adminNeu.btnGhost}
            >
              AI instructions
            </button>
          </div>
        </div>

        {showConfig ? (
          <div className="mt-3 rounded-xl border border-sky-100 bg-[#f5f9fc] p-3">
            {configLoading ? (
              <p className="text-xs text-slate-500">Loading…</p>
            ) : (
              <>
                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={configEnabled}
                    onChange={(e) => setConfigEnabled(e.target.checked)}
                    className="rounded border-sky-200 bg-white"
                  />
                  Email automation enabled (IMAP fetch + AI drafts · send via Resend)
                </label>
                <textarea
                  rows={3}
                  value={configInstructions}
                  onChange={(e) => setConfigInstructions(e.target.value)}
                  placeholder="Optional custom instructions…"
                  className="mt-2 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => void saveConfig()} disabled={configSaving} className={adminNeu.btnPrimary}>
                    {configSaving ? "Saving…" : "Save settings"}
                  </button>
                  <button type="button" onClick={() => setShowDefaultCeo((v) => !v)} className="text-xs text-slate-500 hover:text-slate-700">
                    {showDefaultCeo ? "Hide" : "View"} CEO default
                  </button>
                </div>
                {showDefaultCeo ? (
                  <pre className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-sky-100 bg-white p-3 text-[11px] text-slate-500">
                    {ceoDefault}
                  </pre>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </AdminPanel>

      {/* 3 columns: categories | email list | body + draft — each scrolls on its own */}
      <div className={`${adminNeu.panel} !p-0 flex min-h-0 flex-1 overflow-hidden`}>
        {/* Column 1 — categories */}
        <nav
          aria-label="Email categories"
          className="flex w-[11.5rem] shrink-0 flex-col overflow-y-auto border-r border-sky-200 bg-white"
        >
          <p className="shrink-0 px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Categories
          </p>
          <div className="flex flex-col gap-0.5 px-2 pb-2">
            {primaryFilters.map((f) => {
              const count = stats ? stats[f.statKey] : undefined;
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key || "received"}
                  type="button"
                  onClick={() => selectCategory(f.key)}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-brand/10 text-brand"
                      : "text-slate-600 hover:bg-brand/5 hover:text-brand"
                  }`}
                >
                  <span>{f.label}</span>
                  {typeof count === "number" ? (
                    <span className={`tabular-nums text-[11px] ${active ? "text-brand" : "text-slate-400"}`}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mx-3 border-t border-sky-100" />
          <p className="shrink-0 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            More
          </p>
          <div className="flex flex-col gap-0.5 px-2 pb-3">
            {secondaryFilters.map((f) => {
              const count = stats ? stats[f.statKey] : undefined;
              const active = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => selectCategory(f.key)}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium ${
                    active ? "bg-brand/10 text-brand" : "text-slate-500 hover:bg-brand/5 hover:text-slate-700"
                  }`}
                >
                  <span>{f.label}</span>
                  {typeof count === "number" ? <span className="tabular-nums text-[10px]">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Column 2 — email list (own scroll) */}
        <aside className="flex w-[min(100%,20rem)] shrink-0 flex-col border-r border-sky-200 bg-[#f8fbfe]">
          <div className="shrink-0 border-b border-sky-100 p-2.5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mail…"
              className="w-full rounded-lg border border-sky-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {listLoading ? (
              <p className="py-12 text-center text-xs text-slate-500">Loading…</p>
            ) : filteredThreads.length === 0 ? (
              <p className="px-3 py-12 text-center text-xs text-slate-500">No messages in this category</p>
            ) : (
              filteredThreads.map((t) => {
                const active = selected?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void openThread(t.id)}
                    className={`flex w-full gap-2.5 border-b border-sky-100 px-2.5 py-2.5 text-left transition-colors hover:bg-brand/5 ${
                      active ? "bg-brand/10 ring-1 ring-inset ring-brand/25" : ""
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-slate-700">
                      {initials(t.fromName, t.fromEmail)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[13px] font-medium text-slate-800">
                          {t.fromName || t.fromEmail}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">{fmtDateShort(t.receivedAt)}</span>
                      </div>
                      <p className="truncate text-[11px] text-slate-500">{t.subject}</p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset ${STATUS_TONE[t.status as EmailStatus]}`}
                      >
                        {STATUS_LABELS[t.status as EmailStatus]}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {total > LIMIT ? (
            <div className="flex shrink-0 items-center justify-between border-t border-sky-100 px-2.5 py-1.5 text-[11px] text-slate-500">
              <button type="button" disabled={offset === 0} onClick={() => void loadThreads(Math.max(0, offset - LIMIT))} className="disabled:opacity-30">
                ←
              </button>
              <span>
                {offset + 1}–{Math.min(offset + LIMIT, total)} / {total}
              </span>
              <button type="button" disabled={offset + LIMIT >= total} onClick={() => void loadThreads(offset + LIMIT)} className="disabled:opacity-30">
                →
              </button>
            </div>
          ) : null}
        </aside>

        {/* Column 3 — body + AI draft in fixed scroll boxes */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#eef4fb]/50">
          {detailLoading ? (
            <p className="py-16 text-center text-sm text-slate-500">Opening message…</p>
          ) : !selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium text-slate-500">Select an email</p>
              <p className="max-w-xs text-xs text-slate-400">
                Body and AI draft open here in separate scrollable panels.
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${STATUS_TONE[selected.status]}`}
                  >
                    {STATUS_LABELS[selected.status]}
                  </span>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{selected.subject}</p>
                  <p className="truncate text-xs text-slate-500">
                    {selected.fromName || selected.fromEmail} · {fmtDate(selected.receivedAt)}
                  </p>
                </div>
              </div>

              {selected.draftError ? (
                <div className={`${adminNeu.alertDanger} shrink-0 px-3 py-2 text-xs text-rose-700`}>
                  <p className="font-medium">Draft failed</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{selected.draftError}</p>
                </div>
              ) : null}

              {/* Received body — scrollable box */}
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm">
                <header className="shrink-0 border-b border-sky-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Email body</p>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {selected.body || "(empty)"}
                  </div>
                </div>
              </section>

              {/* AI draft — scrollable box */}
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-brand/25 bg-white shadow-sm">
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-sky-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">AI draft reply</p>
                  {canAct && !editingDraft && selected.draftReply ? (
                    <button type="button" onClick={() => setEditingDraft(true)} className="text-[11px] font-medium text-brand hover:underline">
                      Edit
                    </button>
                  ) : null}
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                  {editingDraft ? (
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      className="h-full min-h-[8rem] w-full resize-none bg-transparent text-sm leading-relaxed text-slate-700 focus:outline-none"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {selected.draftReply || "(Draft not ready yet — pipeline may still be running)"}
                    </div>
                  )}
                </div>
              </section>

              {actionError ? (
                <div className={`${adminNeu.alertDanger} shrink-0 px-3 py-2 text-xs text-rose-700`}>{actionError}</div>
              ) : null}
              {actionSuccess ? (
                <div className={`${adminNeu.alertInfo} shrink-0 px-3 py-2 text-xs text-emerald-700`}>{actionSuccess}</div>
              ) : null}

              <div className="flex shrink-0 flex-wrap gap-2">
                {canRetryDraft ? (
                  <button type="button" onClick={() => void doRetry()} disabled={actionBusy} className={adminNeu.btnPrimary}>
                    {actionBusy ? "Generating…" : "Retry AI draft"}
                  </button>
                ) : null}
                {["awaiting_approval", "editing", "failed"].includes(selected.status) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void doApprove()}
                      disabled={actionBusy || !selected.draftReply}
                      className={adminNeu.btnPrimary}
                    >
                      {actionBusy ? "Sending…" : editingDraft ? "Save & send" : "Approve & send"}
                    </button>
                    <button type="button" onClick={() => setShowRevise((v) => !v)} disabled={actionBusy} className={adminNeu.btnGhost}>
                      Regenerate
                    </button>
                    <button type="button" onClick={() => void doIgnore()} disabled={actionBusy} className={adminNeu.btnGhost}>
                      Ignore
                    </button>
                  </>
                ) : null}
                {selected.status === "sent" ? (
                  <span className="text-xs text-emerald-700">Reply sent to {selected.fromEmail}</span>
                ) : null}
              </div>

              {showRevise ? (
                <div className="shrink-0 rounded-xl border border-sky-100 bg-white p-3">
                  <textarea
                    rows={2}
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="Revision notes for the AI (optional)…"
                    className="w-full rounded-lg border border-sky-200 px-2.5 py-1.5 text-sm text-slate-700"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => void doRegenerate()} disabled={actionBusy} className={adminNeu.btnPrimary}>
                      {actionBusy ? "Generating…" : "Generate new draft"}
                    </button>
                    <button type="button" onClick={() => setShowRevise(false)} className={adminNeu.btnGhost}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>

      <EmailTemplateStudio apiFetch={apiFetch} open={showTemplates} onClose={() => setShowTemplates(false)} />
    </div>
  );
}
