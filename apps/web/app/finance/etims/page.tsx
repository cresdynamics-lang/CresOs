"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../auth-context";
import { financeNeu } from "../../../components/finance/finance-theme";

type EtimsConfig = {
  tin: string;
  taxpayerName: string;
  bhfId: string;
  dvcSrlNo: string;
  cmcKey: string | null;
  sdcId: string | null;
  mrcNo: string | null;
  apigeeAppId: string | null;
  hasConsumerKey: boolean;
  hasConsumerSecret: boolean;
  mode: string;
  enabled: boolean;
  autoSubmit: boolean;
  defaultTaxTyCd: string;
  vatInclusive: boolean;
  lastInvcNo: number;
};

export default function FinanceEtimsPage() {
  const { apiFetch } = useAuth();
  const [config, setConfig] = useState<EtimsConfig | null>(null);
  const [hasCmcKey, setHasCmcKey] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tin: "P052570833B",
    taxpayerName: "CRES SOFTWARE LIMITED",
    bhfId: "00",
    dvcSrlNo: "CRESOSCU001",
    cmcKey: "",
    apigeeAppId: "",
    consumerKey: "",
    consumerSecret: "",
    mode: "mock",
    enabled: true,
    autoSubmit: true,
    defaultTaxTyCd: "B",
    vatInclusive: false
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/finance/etims/config");
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error || "Failed to load eTIMS config");
        return;
      }
      const c = j?.data?.config as EtimsConfig;
      setConfig(c);
      setHasCmcKey(Boolean(j?.data?.hasCmcKey));
      setNote(j?.data?.defaults?.note || "");
      setForm({
        tin: c.tin,
        taxpayerName: c.taxpayerName || "CRES SOFTWARE LIMITED",
        bhfId: c.bhfId,
        dvcSrlNo: c.dvcSrlNo,
        cmcKey: "",
        apigeeAppId: c.apigeeAppId || "",
        consumerKey: "",
        consumerSecret: "",
        mode: c.mode || "mock",
        enabled: c.enabled,
        autoSubmit: c.autoSubmit,
        defaultTaxTyCd: c.defaultTaxTyCd || "B",
        vatInclusive: c.vatInclusive
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        tin: form.tin,
        taxpayerName: form.taxpayerName,
        bhfId: form.bhfId,
        dvcSrlNo: form.dvcSrlNo,
        apigeeAppId: form.apigeeAppId.trim() || null,
        mode: form.mode,
        enabled: form.enabled,
        autoSubmit: form.autoSubmit,
        defaultTaxTyCd: form.defaultTaxTyCd,
        vatInclusive: form.vatInclusive
      };
      if (form.cmcKey.trim()) body.cmcKey = form.cmcKey.trim();
      if (form.consumerKey.trim()) body.consumerKey = form.consumerKey.trim();
      if (form.consumerSecret.trim()) body.consumerSecret = form.consumerSecret.trim();
      const res = await apiFetch("/finance/etims/config", {
        method: "PUT",
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.message || j?.error || "Save failed");
        return;
      }
      setMessage("eTIMS configuration saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const initialize = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch("/finance/etims/initialize", { method: "POST", body: "{}" });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.message || j?.error || "Initialize failed");
        return;
      }
      setMessage(j?.message || "Device initialized");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Initialize failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${financeNeu.workspace} flex min-h-0 flex-1 flex-col gap-5 px-4 py-5 sm:px-6`}>
      <header className="border-b border-[#E1DFDD] pb-4">
        <p className={financeNeu.eyebrow}>Finance · compliance</p>
        <h1 className={`mt-0.5 ${financeNeu.titleSm}`}>eTIMS / OSCU</h1>
        <p className={`mt-2 max-w-2xl ${financeNeu.body}`}>
          Auto-file tax invoices for CRES SOFTWARE LIMITED (PIN{" "}
          <span className="font-semibold text-[#242424]">P052570833B</span>) via GavaConnect. Enter each buyer’s
          KRA PIN on the invoice (or save it on the client).
        </p>
      </header>

      {note ? (
        <div className="rounded-xl border border-[#E5E9EF] bg-[#FFF6E5] px-4 py-3 text-sm text-[#92400E]">{note}</div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#5B6472]">Loading configuration…</p>
      ) : (
        <form onSubmit={save} className="grid max-w-2xl gap-4">
          {error ? (
            <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#C62828]">{error}</p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-[#C5E0C0] bg-[#F2F9EF] px-3 py-2 text-sm text-[#1B6B3A]">{message}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                Seller KRA PIN (TIN)
              </span>
              <input
                value={form.tin}
                onChange={(e) => setForm((f) => ({ ...f, tin: e.target.value.toUpperCase() }))}
                className={financeNeu.input}
                placeholder="P052570833B"
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                Taxpayer name
              </span>
              <input
                value={form.taxpayerName}
                onChange={(e) => setForm((f) => ({ ...f, taxpayerName: e.target.value }))}
                className={financeNeu.input}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                Branch (bhfId)
              </span>
              <input
                value={form.bhfId}
                onChange={(e) => setForm((f) => ({ ...f, bhfId: e.target.value }))}
                className={financeNeu.input}
                maxLength={2}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                Device serial
              </span>
              <input
                value={form.dvcSrlNo}
                onChange={(e) => setForm((f) => ({ ...f, dvcSrlNo: e.target.value }))}
                className={financeNeu.input}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                Apigee app id (apigee_app_id)
              </span>
              <input
                value={form.apigeeAppId}
                onChange={(e) => setForm((f) => ({ ...f, apigeeAppId: e.target.value }))}
                className={financeNeu.input}
                placeholder="From GavaConnect / Postman {{apigee_app_id}}"
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                Consumer key{" "}
                {config?.hasConsumerKey ? "(stored — leave blank to keep)" : "(GavaConnect Basic user)"}
              </span>
              <input
                value={form.consumerKey}
                onChange={(e) => setForm((f) => ({ ...f, consumerKey: e.target.value }))}
                className={financeNeu.input}
                placeholder={config?.hasConsumerKey ? "••••••••" : "Consumer key"}
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                Consumer secret{" "}
                {config?.hasConsumerSecret ? "(stored — leave blank to keep)" : "(GavaConnect Basic password)"}
              </span>
              <input
                type="password"
                value={form.consumerSecret}
                onChange={(e) => setForm((f) => ({ ...f, consumerSecret: e.target.value }))}
                className={financeNeu.input}
                placeholder={config?.hasConsumerSecret ? "••••••••" : "Consumer secret"}
                autoComplete="new-password"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                CMC key {hasCmcKey ? "(stored — leave blank to keep)" : "(from Initialize / Postman)"}
              </span>
              <input
                value={form.cmcKey}
                onChange={(e) => setForm((f) => ({ ...f, cmcKey: e.target.value }))}
                className={financeNeu.input}
                placeholder={hasCmcKey ? "••••••••" : "From POST /initialize response"}
                autoComplete="off"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">Mode</span>
              <select
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                className={financeNeu.input}
              >
                <option value="mock">mock (local — no KRA)</option>
                <option value="sandbox">sandbox (sbx.kra.go.ke GavaConnect)</option>
                <option value="production">production (api.kra.go.ke)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#5B6472]">
                Default tax type
              </span>
              <select
                value={form.defaultTaxTyCd}
                onChange={(e) => setForm((f) => ({ ...f, defaultTaxTyCd: e.target.value }))}
                className={financeNeu.input}
              >
                <option value="B">B — VAT 16%</option>
                <option value="A">A — Exempt</option>
                <option value="C">C — Zero-rated</option>
                <option value="D">D — Non-VAT</option>
                <option value="E">E — 8%</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-[#1A1D26]">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              eTIMS enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1A1D26]">
              <input
                type="checkbox"
                checked={form.autoSubmit}
                onChange={(e) => setForm((f) => ({ ...f, autoSubmit: e.target.checked }))}
              />
              Auto-file on invoice create
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1A1D26]">
              <input
                type="checkbox"
                checked={form.vatInclusive}
                onChange={(e) => setForm((f) => ({ ...f, vatInclusive: e.target.checked }))}
              />
              Unit prices include VAT
            </label>
          </div>

          {config ? (
            <dl className="grid grid-cols-2 gap-2 rounded-xl border border-[#E5E9EF] bg-white p-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[10px] uppercase text-[#5B6472]">SDC</dt>
                <dd className="font-medium text-[#1A1D26]">{config.sdcId || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-[#5B6472]">MRC</dt>
                <dd className="font-medium text-[#1A1D26]">{config.mrcNo || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-[#5B6472]">Last invcNo</dt>
                <dd className="font-medium text-[#1A1D26]">{config.lastInvcNo}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-[#5B6472]">CMC</dt>
                <dd className="font-medium text-[#1A1D26]">{config.cmcKey || "not set"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase text-[#5B6472]">GavaConnect</dt>
                <dd className="font-medium text-[#1A1D26]">
                  {config.hasConsumerKey && config.hasConsumerSecret ? "key+secret set" : "credentials incomplete"}
                  {config.apigeeAppId ? ` · app ${config.apigeeAppId.slice(0, 12)}…` : " · no apigee_app_id"}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={financeNeu.btnPrimary}>
              {saving ? "Saving…" : "Save configuration"}
            </button>
            <button type="button" disabled={saving} onClick={() => void initialize()} className={financeNeu.btnGhost}>
              Initialize OSCU device
            </button>
            <Link href="/finance/invoices" className={`${financeNeu.btnGhost} inline-flex items-center`}>
              Back to invoices
            </Link>
          </div>

          <div className="rounded-xl border border-[#E5E9EF] bg-[#F4F7F9] p-4 text-sm text-[#5B6472]">
            <p className="font-semibold text-[#1A1D26]">Sandbox checklist</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[#1A1D26]">
              <li>Import Postman env from <code className="text-xs">tools/etims/postman.environment.sbx.json</code></li>
              <li>Paste consumer key/secret + apigee_app_id (or set them here / in API .env)</li>
              <li>Run Access Token → Initialize in Postman, or click Initialize above in sandbox mode</li>
              <li>Create a Finance invoice with buyer PIN — auto-file uses <code className="text-xs">/sendSalesTransaction</code></li>
            </ol>
            <p className="mt-3">
              CLI verify (same as Postman):{" "}
              <code className="text-xs">node tools/etims/verify-gavaconnect.mjs --sales</code>
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
