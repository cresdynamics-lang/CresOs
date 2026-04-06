"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { emitDataRefresh } from "./data-refresh";

const VALID_TIER_IDS = new Set(["execution", "financial", "governance", "structural"]);

const TIERS: { id: string; label: string; hint: string }[] = [
  { id: "execution", label: "Execution", hint: "Tasks, reminders, delivery" },
  { id: "financial", label: "Financial", hint: "Invoices, payments, finance alerts" },
  { id: "governance", label: "Governance", hint: "Approvals, compliance, oversight" },
  { id: "structural", label: "Structural", hint: "Org and access changes" }
];

export type NotificationPrefs = {
  mutedTiers: string[];
  muteAllInApp: boolean;
  playCommunitySound?: boolean;
};

function normalizePrefs(raw: unknown): NotificationPrefs {
  if (!raw || typeof raw !== "object") {
    return { mutedTiers: [], muteAllInApp: false, playCommunitySound: false };
  }
  const o = raw as Record<string, unknown>;
  const muted = Array.isArray(o.mutedTiers)
    ? o.mutedTiers.filter((t): t is string => typeof t === "string" && VALID_TIER_IDS.has(t))
    : [];
  return {
    mutedTiers: Array.from(new Set(muted)),
    muteAllInApp: Boolean(o.muteAllInApp),
    playCommunitySound: Boolean(o.playCommunitySound)
  };
}

export function NotificationPreferencesForm() {
  const { apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [muteAllInApp, setMuteAllInApp] = useState(false);
  const [mutedTiers, setMutedTiers] = useState<Set<string>>(new Set());
  const [playCommunitySound, setPlayCommunitySound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/account/me");
      if (!res.ok) return;
      const data = (await res.json()) as { notificationPreferences?: unknown };
      const p = normalizePrefs(data.notificationPreferences);
      setMuteAllInApp(p.muteAllInApp);
      setMutedTiers(new Set(p.mutedTiers));
      setPlayCommunitySound(Boolean(p.playCommunitySound));
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTier = (id: string) => {
    setMutedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiFetch("/account/me", {
        method: "PATCH",
        body: JSON.stringify({
          notificationPreferences: {
            muteAllInApp,
            mutedTiers: Array.from(mutedTiers),
            playCommunitySound
          }
        })
      });
      if (res.ok) {
        setMessage("Saved.");
        emitDataRefresh();
      } else {
        setMessage("Could not save preferences.");
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-400">Loading preferences…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Control which in-app notifications appear in your bell and count toward the badge. Email notifications are unchanged.
      </p>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3">
        <input
          type="checkbox"
          checked={playCommunitySound}
          onChange={(e) => setPlayCommunitySound(e.target.checked)}
          className="mt-1 rounded border-slate-600"
        />
        <span>
          <span className="block text-sm font-medium text-slate-200">Play loud sound for Community messages</span>
          <span className="text-xs text-slate-500">
            If enabled, CresOS will attempt to play a short sound for incoming Community messages (your browser may require a click first).
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3">
        <input
          type="checkbox"
          checked={muteAllInApp}
          onChange={(e) => setMuteAllInApp(e.target.checked)}
          className="mt-1 rounded border-slate-600"
        />
        <span>
          <span className="block text-sm font-medium text-slate-200">Mute all in-app notifications</span>
          <span className="text-xs text-slate-500">Hides the feed and clears the badge until turned off.</span>
        </span>
      </label>

      <div className={muteAllInApp ? "pointer-events-none opacity-40" : ""}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Hide by category</p>
        <ul className="space-y-2">
          {TIERS.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                <input
                  type="checkbox"
                  checked={mutedTiers.has(t.id)}
                  onChange={() => toggleTier(t.id)}
                  className="mt-1 rounded border-slate-600"
                />
                <span>
                  <span className="block text-sm text-slate-200">{t.label}</span>
                  <span className="text-xs text-slate-500">{t.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save notification controls"}
        </button>
        {message && <span className="text-sm text-slate-400">{message}</span>}
      </div>
    </div>
  );
}
