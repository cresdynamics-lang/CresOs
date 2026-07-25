import { lightSurface } from "../workspace/workspace-light";
import { devNeu } from "../developer/developer-theme";
import { financeNeu } from "../finance/finance-theme";
import { salesNeu } from "../sales/sales-theme";
import type { SettingsWorkspaceKey } from "../../lib/resolve-settings-workspace";

export type SettingsThemeTokens = {
  workspaceClass: string;
  canvas: string;
  panel: string;
  panelInset: string;
  section: string;
  heroBand: string;
  sectionLabel: string;
  listRow: string;
  navActive: string;
  navIdle: string;
  input: string;
  inputReadonly: string;
  btnPrimary: string;
  btnGhost: string;
  accentText: string;
  accentPill: string;
  headerGradient: string;
  toggleOn: string;
};

const sharedFullscreen = {
  section: "border-b border-sky-100 px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
  heroBand:
    "border-b border-sky-100 bg-gradient-to-br from-brand-light/60 via-[#eef4fb] to-white px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
  sectionLabel: "font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500",
  listRow: lightSurface.listRow
};

const globalTokens: SettingsThemeTokens = {
  workspaceClass: "developer-neu",
  canvas: lightSurface.canvas,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  ...sharedFullscreen,
  navActive:
    "border-l-[3px] border-l-brand border-y border-r border-brand/30 bg-brand/10 text-brand font-semibold",
  navIdle: lightSurface.navIdle,
  input: lightSurface.input,
  inputReadonly:
    "w-full rounded-xl border border-sky-100 bg-[#f5f9fc] px-3 py-2.5 text-sm text-slate-500",
  btnPrimary: lightSurface.btnPrimary,
  btnGhost: lightSurface.btnGhost,
  accentText: "text-brand",
  accentPill: "border-brand/25 bg-brand/10 text-brand",
  headerGradient: "from-brand via-sky-500 to-cyan-500",
  toggleOn: "bg-brand"
};

export function getSettingsTheme(key: SettingsWorkspaceKey): SettingsThemeTokens {
  if (key === "developer") {
    return {
      workspaceClass: "developer-neu developer-fullscreen",
      canvas: devNeu.canvas,
      panel: devNeu.panel,
      panelInset: devNeu.panelInset,
      section: sharedFullscreen.section,
      heroBand:
        "border-b border-sky-100 bg-gradient-to-br from-violet-50 via-[#eef4fb] to-white px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
      sectionLabel: "font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-700",
      listRow: devNeu.listRow,
      navActive: devNeu.navActive,
      navIdle: devNeu.navIdle,
      input: devNeu.input,
      inputReadonly: devNeu.inputReadonly,
      btnPrimary: devNeu.btnPrimary,
      btnGhost: devNeu.btnGhost,
      accentText: "text-violet-700",
      accentPill: "border-violet-200 bg-violet-50 text-violet-800",
      headerGradient: "from-violet-600 via-indigo-500 to-brand",
      toggleOn: "bg-violet-600"
    };
  }
  if (key === "finance") {
    return {
      workspaceClass: "finance-neu finance-fullscreen",
      canvas: financeNeu.canvas,
      panel: financeNeu.panel,
      panelInset: financeNeu.panelInset,
      section: sharedFullscreen.section,
      heroBand:
        "border-b border-sky-100 bg-gradient-to-br from-emerald-50 via-[#eef4fb] to-white px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
      sectionLabel: "font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700",
      listRow: sharedFullscreen.listRow,
      navActive: financeNeu.navActive,
      navIdle: financeNeu.navIdle,
      input: financeNeu.input,
      inputReadonly:
        "w-full rounded-xl border border-sky-100 bg-[#f5f9fc] px-3 py-2.5 text-sm text-slate-500",
      btnPrimary: financeNeu.btnPrimary,
      btnGhost: financeNeu.btnGhost,
      accentText: "text-emerald-700",
      accentPill: "border-emerald-200 bg-emerald-50 text-emerald-800",
      headerGradient: "from-emerald-600 via-teal-500 to-brand",
      toggleOn: "bg-emerald-600"
    };
  }
  if (key === "sales") {
    return {
      workspaceClass: "sales-neu sales-fullscreen",
      canvas: salesNeu.canvas,
      panel: salesNeu.panel,
      panelInset: salesNeu.panelInset,
      section: sharedFullscreen.section,
      heroBand:
        "border-b border-sky-100 bg-gradient-to-br from-amber-50 via-[#eef4fb] to-white px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
      sectionLabel: "font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700",
      listRow: sharedFullscreen.listRow,
      navActive: salesNeu.navActive,
      navIdle: salesNeu.navIdle,
      input: salesNeu.input,
      inputReadonly:
        "w-full rounded-xl border border-sky-100 bg-[#f5f9fc] px-3 py-2.5 text-sm text-slate-500",
      btnPrimary: salesNeu.btnPrimary,
      btnGhost: salesNeu.btnGhost,
      accentText: "text-amber-700",
      accentPill: "border-amber-200 bg-amber-50 text-amber-900",
      headerGradient: "from-amber-500 via-orange-500 to-brand",
      toggleOn: "bg-amber-600"
    };
  }
  return globalTokens;
}
