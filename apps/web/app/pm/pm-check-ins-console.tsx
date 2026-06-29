"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../auth-context";
import { pmNeu } from "../../components/pm/pm-theme";
import { PmBanner, PmDataBlock, PmFullscreenPage, PmPageHero } from "../../components/pm/pm-shell";
import { canAccessPmWorkspace } from "../../lib/is-pm-only";

type CheckIn = {
  id: string;
  message: string;
  status: string;
  aiGenerated: boolean;
  senderRole?: string;
  questionsJson?: { id: string; text: string }[];
  response?: string | null;
  dayKey: string;
  project?: { id: string; name: string };
  developer?: { id: string; name: string };
  sentBy?: { id: string; name: string };
};

type PmProject = { id: string; name: string };
type TeamMember = { id: string; name: string };

export function PmCheckInsConsole() {
  const { apiFetch, auth } = useAuth();
  const canAccess = canAccessPmWorkspace(auth.roleKeys);
  const searchParams = useSearchParams();
  const prefillDev = searchParams.get("developer");

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [projectId, setProjectId] = useState("");
  const [developerId, setDeveloperId] = useState(prefillDev ?? "");
  const [message, setMessage] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [sending, setSending] = useState(false);
  const [batchSending, setBatchSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ciRes, projRes, teamRes] = await Promise.all([
      apiFetch("/pm/check-ins"),
      apiFetch("/pm/projects"),
      apiFetch("/pm/team")
    ]);
    if (ciRes.ok) setCheckIns((await ciRes.json()) as CheckIn[]);
    if (projRes.ok) {
      const list = (await projRes.json()) as PmProject[];
      setProjects(list);
      if (!projectId && list[0]) setProjectId(list[0].id);
    }
    if (teamRes.ok) setTeam((await teamRes.json()) as TeamMember[]);
  }, [apiFetch, projectId]);

  useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  useEffect(() => {
    if (prefillDev) setDeveloperId(prefillDev);
  }, [prefillDev]);

  const pendingCount = useMemo(() => checkIns.filter((c) => c.status === "pending").length, [checkIns]);

  const sendOne = async () => {
    if (!projectId || !developerId) {
      setError("Select a project and developer");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch("/pm/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          developerId,
          message: useAi ? undefined : message,
          useAi
        })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Send failed");
      }
      setMessage("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const sendBatch = async () => {
    setBatchSending(true);
    setError(null);
    try {
      const res = await apiFetch("/pm/check-ins/daily-batch", { method: "POST" });
      if (!res.ok) throw new Error("Batch failed");
      await load();
    } catch {
      setError("Daily batch could not run");
    } finally {
      setBatchSending(false);
    }
  };

  if (!canAccess) return null;

  return (
    <PmFullscreenPage>
      <PmPageHero
        eyebrow="Check-ins"
        title="Daily developer pulse"
        description="AI generates role-specific questions (PM = agile delivery, Director = strategic accountability). Each question gets its own answer field in Talks."
        backHref="/pm"
        actions={
          <button type="button" className={pmNeu.btnPrimary} disabled={batchSending} onClick={() => void sendBatch()}>
            {batchSending ? "Running…" : "Batch all active projects"}
          </button>
        }
      />

      {error ? <PmBanner tone="warning" title={error} /> : null}
      {pendingCount > 0 ? (
        <PmBanner
          tone="info"
          title={`${pendingCount} awaiting developer response`}
          detail="Responses notify directors and PMs."
        />
      ) : null}

      <div className={`${pmNeu.panel} mx-5 mb-6 lg:mx-8`}>
        <p className="mb-3 text-sm font-medium text-slate-200">Send check-in</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="rounded-lg border border-white/[0.06] bg-[#0e1319] px-3 py-2 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-white/[0.06] bg-[#0e1319] px-3 py-2 text-sm"
            value={developerId}
            onChange={(e) => setDeveloperId(e.target.value)}
          >
            <option value="">Select developer</option>
            {team.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
          Use AI to vary daily wording
        </label>
        {!useAi ? (
          <textarea
            className="mt-2 w-full rounded-lg border border-white/[0.06] bg-[#0e1319] p-3 text-sm"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your message to the developer"
          />
        ) : null}
        <button
          type="button"
          className={`${pmNeu.btnPrimary} mt-3`}
          disabled={sending}
          onClick={() => void sendOne()}
        >
          {sending ? "Sending…" : "Send to Talks"}
        </button>
      </div>

      <PmDataBlock>
        {checkIns.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 lg:px-8">No check-ins yet.</p>
        ) : (
          checkIns.map((c) => (
            <div key={c.id} className={pmNeu.listRow}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{c.project?.name}</span>
                <span>·</span>
                <span>{c.developer?.name}</span>
                <span>·</span>
                <span>{c.dayKey}</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase">
                  {c.senderRole === "director_admin" ? "Director" : "PM"}
                </span>
                {c.aiGenerated ? (
                  <span className="rounded bg-teal-500/10 px-1 text-teal-400">AI questions</span>
                ) : null}
                <span className={c.status === "answered" ? "text-emerald-400" : "text-amber-400"}>{c.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-200">{c.message}</p>
              {Array.isArray(c.questionsJson) && c.questionsJson.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  {c.questionsJson.map((q) => (
                    <li key={q.id}>• {q.text}</li>
                  ))}
                </ul>
              ) : null}
              {c.response ? (
                <p className="mt-2 rounded-lg bg-[#0e1319] p-2 text-sm text-slate-400">Reply: {c.response}</p>
              ) : null}
            </div>
          ))
        )}
      </PmDataBlock>
    </PmFullscreenPage>
  );
}
