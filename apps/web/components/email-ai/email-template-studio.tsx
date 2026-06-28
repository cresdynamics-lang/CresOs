"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminNeu } from "../admin/admin-theme";
import type { EmailTemplate } from "./email-ai-types";
import {
  DESIGN_PRESETS,
  FONT_OPTIONS,
  apiBaseUrl,
  applyTemplateVars,
  compileTemplateHtml,
  defaultDesignForKey,
  mergeDesign,
  resolveEmailAssetUrl,
  type EmailHeaderStyle,
  type EmailTemplateDesign
} from "../../lib/email-template-design";

type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

type StudioTab = "brand" | "header" | "typography" | "content" | "footer" | "advanced";

const SAMPLE_VARS: Record<string, string> = {
  body: "Thank you for reaching out. We would be glad to schedule a discovery call this week to discuss your requirements in detail.\n\nLooking forward to connecting.",
  subject: "Partnership inquiry",
  recipient_name: "Alex Morgan",
  greeting: "Hi Alex,",
  channel_label: "Sales",
  footer_note: "This message was sent from Cres Dynamics."
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{children}</span>
  );
}

function ColorField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.startsWith("#") ? value : "#6366f1"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#121820] px-2.5 py-2 font-mono text-xs text-slate-200"
        />
      </div>
    </label>
  );
}

function ImageUploadField({
  label,
  hint,
  value,
  uploading,
  onUpload,
  onClear
}: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = value ? resolveEmailAssetUrl(value, apiBaseUrl()) : "";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0e1319] p-3">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
      {preview ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-28 w-full object-contain p-2" />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={adminNeu.btnGhost}
        >
          {uploading ? "Uploading…" : preview ? "Replace image" : "Upload image"}
        </button>
        {value ? (
          <button type="button" onClick={onClear} className={adminNeu.btnGhost}>
            Remove
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export function EmailTemplateStudio({
  apiFetch,
  open,
  onClose
}: {
  apiFetch: ApiFetch;
  open: boolean;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState("reply");
  const [tab, setTab] = useState<StudioTab>("brand");
  const [design, setDesign] = useState<EmailTemplateDesign>(() => defaultDesignForKey("reply"));
  const [subject, setSubject] = useState("");
  const [textBody, setTextBody] = useState("");
  const [useCustomHtml, setUseCustomHtml] = useState(false);
  const [customHtml, setCustomHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "hero" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((t) => t.key === selectedKey) ?? null,
    [templates, selectedKey]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/email-automation/templates");
      if (res.ok) {
        const d = (await res.json()) as { templates?: EmailTemplate[] };
        const list = d.templates ?? [];
        setTemplates(list);
        const pick = list.find((t) => t.key === "reply") ?? list[0];
        if (pick) hydrateFromTemplate(pick);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  function hydrateFromTemplate(t: EmailTemplate) {
    setSelectedKey(t.key);
    setDesign(mergeDesign(t.key, t.design));
    setSubject(t.subject);
    setTextBody(t.textBody);
    setUseCustomHtml(t.useCustomHtml === true);
    setCustomHtml(t.htmlBody);
    setMessage(null);
    setTab("brand");
  }

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const compiledHtml = useMemo(() => {
    if (useCustomHtml) return customHtml;
    return compileTemplateHtml(design, apiBaseUrl());
  }, [design, useCustomHtml, customHtml]);

  const previewHtml = useMemo(
    () => applyTemplateVars(compiledHtml, SAMPLE_VARS),
    [compiledHtml]
  );

  const patchDesign = (patch: Partial<EmailTemplateDesign>) => {
    setDesign((d) => ({ ...d, ...patch }));
    setUseCustomHtml(false);
  };

  const uploadAsset = async (file: File, target: "logo" | "hero") => {
    setUploading(target);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/email-automation/assets", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setMessage(data.error ?? "Image upload failed");
        return;
      }
      if (target === "logo") {
        patchDesign({ logoUrl: data.url, showLogo: true });
      } else {
        patchDesign({ heroImageUrl: data.url, showHeroImage: true, headerStyle: "image" });
      }
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const htmlBody = useCustomHtml ? customHtml : compileTemplateHtml(design, apiBaseUrl());
      const res = await apiFetch(`/email-automation/templates/${selected.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          textBody,
          htmlBody,
          design,
          useCustomHtml
        })
      });
      if (res.ok) {
        const d = (await res.json()) as { template?: EmailTemplate };
        if (d.template) {
          setTemplates((prev) => prev.map((t) => (t.key === d.template!.key ? d.template! : t)));
        }
        setMessage("Template saved — all outbound emails and AI replies will use this design.");
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(err.error ?? "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const tabs: { id: StudioTab; label: string }[] = [
    { id: "brand", label: "Brand" },
    { id: "header", label: "Header" },
    { id: "typography", label: "Typography" },
    { id: "content", label: "Content" },
    { id: "footer", label: "Footer" },
    { id: "advanced", label: "Advanced" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-[#070a0e]/90 backdrop-blur-md">
      <div className="flex min-h-0 w-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0b0f14] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">Email AI Studio</p>
            <h2 className="text-xl font-semibold text-slate-100">Craft your email templates</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Fonts, colors, images, and layout — used for AI replies and all outbound mail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void save()} disabled={saving} className={adminNeu.btnPrimary}>
              {saving ? "Saving…" : "Save template"}
            </button>
            <button type="button" onClick={onClose} className={adminNeu.btnGhost}>
              Close
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/[0.06] bg-[#0b0f14] p-3">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Templates</p>
            {loading ? (
              <p className="px-2 text-xs text-slate-500">Loading…</p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => hydrateFromTemplate(t)}
                  className={`rounded-xl px-3 py-2.5 text-left transition-all ${
                    selectedKey === t.key ? adminNeu.navActive : adminNeu.navIdle
                  }`}
                >
                  <p className="text-sm font-medium text-slate-200">{t.name}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{t.category}</p>
                </button>
              ))
            )}
          </aside>

          <section className="flex min-w-0 flex-1 flex-col border-r border-white/[0.06] bg-[#0b0f14]">
            {selected ? (
              <>
                <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
                  <p className="text-sm text-slate-300">{selected.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.variables.map((v) => (
                      <code
                        key={v}
                        className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300 ring-1 ring-indigo-500/20"
                      >
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DESIGN_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => patchDesign(p.patch)}
                        className="rounded-full border border-white/[0.08] bg-[#121820] px-3 py-1 text-[11px] text-slate-300 hover:border-indigo-500/30 hover:text-indigo-200"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        tab === t.id
                          ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/30"
                          : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {tab === "brand" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ColorField label="Primary accent" value={design.accent} onChange={(v) => patchDesign({ accent: v })} />
                      <ColorField
                        label="Secondary accent"
                        value={design.accentSecondary}
                        onChange={(v) => patchDesign({ accentSecondary: v })}
                      />
                      <ColorField
                        label="Page background"
                        value={design.pageBackground}
                        onChange={(v) => patchDesign({ pageBackground: v })}
                      />
                      <ColorField
                        label="Card background"
                        value={design.cardBackground}
                        onChange={(v) => patchDesign({ cardBackground: v })}
                      />
                      <label className="sm:col-span-2 flex flex-col gap-1.5">
                        <FieldLabel>Corner radius ({design.borderRadius}px)</FieldLabel>
                        <input
                          type="range"
                          min={0}
                          max={28}
                          value={design.borderRadius}
                          onChange={(e) => patchDesign({ borderRadius: Number(e.target.value) })}
                          className="w-full accent-indigo-500"
                        />
                      </label>
                    </div>
                  ) : null}

                  {tab === "header" ? (
                    <div className="grid gap-4">
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Header label</FieldLabel>
                        <input
                          value={design.headerLabel}
                          onChange={(e) => patchDesign({ headerLabel: e.target.value })}
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Header title</FieldLabel>
                        <input
                          value={design.headerTitle}
                          onChange={(e) => patchDesign({ headerTitle: e.target.value })}
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Header style</FieldLabel>
                        <select
                          value={design.headerStyle}
                          onChange={(e) => patchDesign({ headerStyle: e.target.value as EmailHeaderStyle })}
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                        >
                          <option value="gradient">Gradient</option>
                          <option value="solid">Solid color</option>
                          <option value="image">Hero image</option>
                        </select>
                      </label>
                      <ColorField
                        label="Heading text color"
                        value={design.headingColor}
                        onChange={(v) => patchDesign({ headingColor: v })}
                      />
                      <ImageUploadField
                        label="Logo"
                        hint="Shown at the top of the email header (PNG, JPG, SVG)."
                        value={design.logoUrl}
                        uploading={uploading === "logo"}
                        onUpload={(f) => void uploadAsset(f, "logo")}
                        onClear={() => patchDesign({ logoUrl: "", showLogo: false })}
                      />
                      <ImageUploadField
                        label="Hero banner"
                        hint="Full-width header background image."
                        value={design.heroImageUrl}
                        uploading={uploading === "hero"}
                        onUpload={(f) => void uploadAsset(f, "hero")}
                        onClear={() => patchDesign({ heroImageUrl: "", showHeroImage: false })}
                      />
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={design.showLogo}
                          onChange={(e) => patchDesign({ showLogo: e.target.checked })}
                          className="rounded border-slate-600"
                        />
                        Show logo
                      </label>
                    </div>
                  ) : null}

                  {tab === "typography" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5 sm:col-span-2">
                        <FieldLabel>Font family</FieldLabel>
                        <select
                          value={design.fontFamily}
                          onChange={(e) =>
                            patchDesign({ fontFamily: e.target.value as EmailTemplateDesign["fontFamily"] })
                          }
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                        >
                          {FONT_OPTIONS.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Body size ({design.fontSize}px)</FieldLabel>
                        <input
                          type="range"
                          min={13}
                          max={20}
                          value={design.fontSize}
                          onChange={(e) => patchDesign({ fontSize: Number(e.target.value) })}
                          className="w-full accent-indigo-500"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Heading size ({design.headingSize}px)</FieldLabel>
                        <input
                          type="range"
                          min={18}
                          max={32}
                          value={design.headingSize}
                          onChange={(e) => patchDesign({ headingSize: Number(e.target.value) })}
                          className="w-full accent-indigo-500"
                        />
                      </label>
                      <ColorField label="Body text" value={design.textColor} onChange={(v) => patchDesign({ textColor: v })} />
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Text alignment</FieldLabel>
                        <select
                          value={design.bodyAlign}
                          onChange={(e) => patchDesign({ bodyAlign: e.target.value as "left" | "center" })}
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {tab === "content" ? (
                    <div className="grid gap-4">
                      {selected.category !== "reply" ? (
                        <label className="flex flex-col gap-1.5">
                          <FieldLabel>Email subject line</FieldLabel>
                          <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                          />
                        </label>
                      ) : null}
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Intro line (before body)</FieldLabel>
                        <input
                          value={design.contentIntro}
                          onChange={(e) => patchDesign({ contentIntro: e.target.value })}
                          placeholder="e.g. {{greeting}}"
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Plain-text fallback</FieldLabel>
                        <textarea
                          rows={4}
                          value={textBody}
                          onChange={(e) => setTextBody(e.target.value)}
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 font-mono text-xs text-slate-200"
                        />
                      </label>
                      <div className="rounded-xl border border-white/[0.06] bg-[#0e1319] p-3">
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={design.showButton}
                            onChange={(e) => patchDesign({ showButton: e.target.checked })}
                          />
                          Add call-to-action button
                        </label>
                        {design.showButton ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5 sm:col-span-2">
                              <FieldLabel>Button label</FieldLabel>
                              <input
                                value={design.buttonLabel}
                                onChange={(e) => patchDesign({ buttonLabel: e.target.value })}
                                className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                              />
                            </label>
                            <label className="flex flex-col gap-1.5 sm:col-span-2">
                              <FieldLabel>Button URL</FieldLabel>
                              <input
                                value={design.buttonUrl}
                                onChange={(e) => patchDesign({ buttonUrl: e.target.value })}
                                className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                              />
                            </label>
                            <ColorField
                              label="Button color"
                              value={design.buttonColor}
                              onChange={(v) => patchDesign({ buttonColor: v })}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {tab === "footer" ? (
                    <div className="grid gap-4">
                      <label className="flex flex-col gap-1.5">
                        <FieldLabel>Footer text</FieldLabel>
                        <textarea
                          rows={3}
                          value={design.footerText}
                          onChange={(e) => patchDesign({ footerText: e.target.value })}
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 text-sm text-slate-200"
                        />
                      </label>
                      <ColorField
                        label="Footer background"
                        value={design.footerBackground}
                        onChange={(v) => patchDesign({ footerBackground: v })}
                      />
                    </div>
                  ) : null}

                  {tab === "advanced" ? (
                    <div className="grid gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={useCustomHtml}
                          onChange={(e) => {
                            setUseCustomHtml(e.target.checked);
                            if (e.target.checked) setCustomHtml(compiledHtml);
                          }}
                        />
                        Edit raw HTML (overrides visual designer)
                      </label>
                      {useCustomHtml ? (
                        <textarea
                          rows={16}
                          value={customHtml}
                          onChange={(e) => setCustomHtml(e.target.value)}
                          className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 font-mono text-xs leading-relaxed text-slate-200"
                        />
                      ) : (
                        <label className="flex flex-col gap-1.5">
                          <FieldLabel>Custom CSS (injected in &lt;head&gt;)</FieldLabel>
                          <textarea
                            rows={6}
                            value={design.customCss}
                            onChange={(e) => patchDesign({ customCss: e.target.value })}
                            placeholder=".email-body a { color: #6366f1; }"
                            className="rounded-lg border border-white/[0.08] bg-[#121820] px-3 py-2 font-mono text-xs text-slate-200"
                          />
                        </label>
                      )}
                    </div>
                  ) : null}
                </div>

                {message ? (
                  <footer className="shrink-0 border-t border-white/[0.06] px-4 py-2">
                    <p className={`text-xs ${message.toLowerCase().includes("fail") ? "text-rose-400" : "text-emerald-400"}`}>
                      {message}
                    </p>
                  </footer>
                ) : null}
              </>
            ) : null}
          </section>

          <aside className="flex w-[min(100%,28rem)] shrink-0 flex-col bg-[#e8edf3]">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Live preview</p>
              <span className="text-[10px] text-slate-400">Sample data</span>
            </div>
            <iframe
              title="Email template preview"
              srcDoc={previewHtml}
              className="min-h-0 flex-1 w-full border-0 bg-white"
              sandbox=""
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
