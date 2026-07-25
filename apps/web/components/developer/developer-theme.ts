import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics Developer workspace (violet accent on light canvas). */
export const devNeu = {
  workspace: "developer-neu",
  canvas: lightSurface.canvas,
  shell: lightSurface.shell,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navActive:
    "border-l-[3px] border-l-violet-600 border-y border-r border-violet-300 bg-violet-50 text-violet-900 font-semibold",
  navIdle: lightSurface.navIdle,
  listRow: lightSurface.listRow,
  input:
    "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/15",
  inputReadonly:
    "w-full rounded-xl border border-sky-100 bg-[#f5f9fc] px-3 py-2.5 text-sm text-slate-500",
  btnPrimary:
    "rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 disabled:opacity-50",
  btnGhost: lightSurface.btnGhost,
  statViolet: lightSurface.statViolet,
  statEmerald: lightSurface.statEmerald,
  statRose: lightSurface.statRose,
  statSky: lightSurface.statSky,
  statAmber: lightSurface.statAmber,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  alertInfo: "rounded-xl border border-violet-200 bg-violet-50 shadow-sm",
  chartPanel: lightSurface.chartPanel,
  kpiStrip: lightSurface.kpiStrip
} as const;
