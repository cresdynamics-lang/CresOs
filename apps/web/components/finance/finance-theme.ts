import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics Finance workspace (emerald accent on light brand canvas). */
export const financeNeu = {
  workspace: "finance-neu",
  canvas: lightSurface.canvas,
  shell: lightSurface.shell,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  listRow: lightSurface.listRow,
  navActive:
    "border-l-[3px] border-l-emerald-600 border-y border-r border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold",
  navIdle: lightSurface.navIdle,
  input:
    "rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/15",
  btnPrimary:
    "rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50",
  btnGhost: lightSurface.btnGhost,
  statEmerald: lightSurface.statEmerald,
  statAmber: lightSurface.statAmber,
  statRose: lightSurface.statRose,
  statViolet: lightSurface.statViolet,
  tableWrap: lightSurface.tableWrap,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  alertInfo: "rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm",
  kpiStrip: lightSurface.kpiStrip
} as const;
