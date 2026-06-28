"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SettingsThemeTokens } from "./settings-theme";
import { getSettingsTheme } from "./settings-theme";
import type { SettingsWorkspaceKey } from "../../lib/resolve-settings-workspace";

const SettingsThemeContext = createContext<SettingsThemeTokens>(getSettingsTheme("global"));

export function SettingsThemeProvider({
  workspaceKey,
  children
}: {
  workspaceKey: SettingsWorkspaceKey;
  children: ReactNode;
}) {
  return (
    <SettingsThemeContext.Provider value={getSettingsTheme(workspaceKey)}>
      {children}
    </SettingsThemeContext.Provider>
  );
}

export function useSettingsTheme(): SettingsThemeTokens {
  return useContext(SettingsThemeContext);
}

export function SettingsPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex w-full min-w-0 flex-1 flex-col ${className}`}>{children}</div>;
}

export function SettingsPanel({
  children,
  className = "",
  inset = false,
  variant = "flat"
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
  /** flat = fullscreen section dividers; card = legacy raised panel */
  variant?: "flat" | "card";
}) {
  const t = useSettingsTheme();
  if (variant === "card") {
    return <div className={`${inset ? t.panelInset : t.panel} ${className}`}>{children}</div>;
  }
  return <div className={`${t.section} ${className}`}>{children}</div>;
}

export function SettingsHero({ children, className = "" }: { children: ReactNode; className?: string }) {
  const t = useSettingsTheme();
  return <div className={`${t.heroBand} ${className}`}>{children}</div>;
}

export function SettingsFormGrid({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid w-full max-w-4xl gap-5 sm:grid-cols-2 ${className}`}>{children}</div>
  );
}

export function SettingsFormGridFull({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`w-full max-w-4xl ${className}`}>{children}</div>;
}

export function SettingsSection({
  title,
  description,
  children,
  className = "",
  label
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Optional uppercase section label above the title */
  label?: string;
}) {
  const t = useSettingsTheme();
  return (
    <section className={`flex flex-col gap-5 ${className}`}>
      <div>
        {label ? <p className={`mb-2 ${t.sectionLabel}`}>{label}</p> : null}
        <h2 className="font-display text-lg font-semibold text-slate-100 sm:text-xl">{title}</h2>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsField({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </label>
  );
}

export function SettingsToggle({
  label,
  description,
  on,
  onChange,
  disabled
}: {
  label: string;
  description?: string;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const t = useSettingsTheme();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? t.toggleOn : "bg-slate-600"}`}
      >
        <span
          className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${
            on ? "translate-x-[1.35rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsMessage({ type, children }: { type: "ok" | "error"; children: ReactNode }) {
  return (
    <p className={`text-sm ${type === "ok" ? "text-emerald-400" : "text-rose-400"}`}>{children}</p>
  );
}

export function SettingsSaveBar({
  dirty,
  saving,
  onSave,
  label = "Save changes",
  successMessage,
  errorMessage
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  label?: string;
  successMessage?: string | null;
  errorMessage?: string | null;
}) {
  const t = useSettingsTheme();
  if (!dirty && !saving && !successMessage && !errorMessage) return null;
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] bg-[#0b0f14]/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {(dirty || saving) && (
        <button type="button" disabled={saving || !dirty} onClick={onSave} className={t.btnPrimary}>
          {saving ? "Saving…" : label}
        </button>
      )}
      {dirty && !saving ? (
        <span className="text-xs text-slate-500">Unsaved changes</span>
      ) : null}
      {successMessage && !dirty ? <SettingsMessage type="ok">{successMessage}</SettingsMessage> : null}
      {errorMessage ? <SettingsMessage type="error">{errorMessage}</SettingsMessage> : null}
    </div>
  );
}
