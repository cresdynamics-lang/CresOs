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
  section: "border-b border-white/[0.06] px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
  heroBand:
    "border-b border-white/[0.06] bg-gradient-to-br from-[#121820]/90 via-[#0b0f14] to-transparent px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
  sectionLabel: "font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500",
  listRow: "rounded-xl border border-white/[0.05] bg-[#0e1319]/60 px-4 py-3"
};

const globalTokens: SettingsThemeTokens = {
  workspaceClass: "developer-neu",
  canvas: "bg-[#0b0f14]",
  panel: "rounded-2xl border border-white/[0.06] bg-[#121820] p-4 sm:p-5",
  panelInset: "rounded-xl border border-white/[0.04] bg-[#0e1319] p-3 sm:p-4",
  ...sharedFullscreen,
  navActive: "border border-sky-500/30 bg-sky-500/10 text-sky-100",
  navIdle:
    "border border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-slate-200",
  input:
    "w-full rounded-xl border border-white/[0.06] bg-[#0e1319] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/30 focus:outline-none focus:ring-2 focus:ring-sky-500/15",
  inputReadonly:
    "w-full rounded-xl border border-white/[0.04] bg-[#0e1319]/60 px-3 py-2.5 text-sm text-slate-500",
  btnPrimary: "rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50",
  btnGhost:
    "rounded-xl border border-white/[0.06] bg-[#121820] px-3 py-2 text-sm text-slate-200 hover:text-white disabled:opacity-50",
  accentText: "text-sky-300",
  accentPill: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  headerGradient: "from-sky-300 via-cyan-200 to-slate-200",
  toggleOn: "bg-sky-500"
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
        "border-b border-white/[0.06] bg-gradient-to-br from-violet-950/25 via-[#0b0f14] to-transparent px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
      sectionLabel: "font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-400/80",
      listRow: devNeu.listRow,
      navActive: devNeu.navActive,
      navIdle: devNeu.navIdle,
      input: devNeu.input,
      inputReadonly: devNeu.inputReadonly,
      btnPrimary: devNeu.btnPrimary,
      btnGhost: devNeu.btnGhost,
      accentText: "text-violet-300",
      accentPill: "border-violet-500/25 bg-violet-500/10 text-violet-300",
      headerGradient: "from-violet-300 via-indigo-200 to-slate-200",
      toggleOn: "bg-violet-500"
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
        "border-b border-white/[0.06] bg-gradient-to-br from-emerald-950/25 via-[#0b0f14] to-transparent px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
      sectionLabel: "font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/80",
      listRow: sharedFullscreen.listRow,
      navActive: financeNeu.navActive,
      navIdle: financeNeu.navIdle,
      input: financeNeu.input,
      inputReadonly:
        "w-full rounded-xl border border-white/[0.04] bg-[#0e1319]/60 px-3 py-2.5 text-sm text-slate-500 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)]",
      btnPrimary: financeNeu.btnPrimary,
      btnGhost: financeNeu.btnGhost,
      accentText: "text-emerald-300",
      accentPill: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      headerGradient: "from-emerald-300 via-teal-200 to-slate-200",
      toggleOn: "bg-emerald-500"
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
        "border-b border-white/[0.06] bg-gradient-to-br from-amber-950/25 via-[#0b0f14] to-transparent px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
      sectionLabel: "font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/80",
      listRow: sharedFullscreen.listRow,
      navActive: salesNeu.navActive,
      navIdle: salesNeu.navIdle,
      input:
        "w-full rounded-xl border border-white/[0.05] bg-[#0e1319] px-3 py-2.5 text-sm text-slate-100 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)] placeholder:text-slate-500 focus:border-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500/15",
      inputReadonly:
        "w-full rounded-xl border border-white/[0.04] bg-[#0e1319]/60 px-3 py-2.5 text-sm text-slate-500 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)]",
      btnPrimary: salesNeu.btnPrimary,
      btnGhost:
        "rounded-xl border border-white/[0.06] bg-[#121820] px-3 py-2 text-sm text-slate-200 shadow-[4px_4px_10px_rgba(0,0,0,0.35)] hover:text-white disabled:opacity-50",
      accentText: "text-amber-300",
      accentPill: "border-amber-500/25 bg-amber-500/10 text-amber-300",
      headerGradient: "from-amber-300 via-orange-200 to-slate-200",
      toggleOn: "bg-amber-500"
    };
  }
  return globalTokens;
}
