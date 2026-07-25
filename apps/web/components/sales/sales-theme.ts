import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics Sales workspace (amber accent). */
export const salesNeu = {
  workspace: "sales-neu",
  canvas: lightSurface.canvas,
  shell: lightSurface.shell,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navActive:
    "border-l-[3px] border-l-amber-600 border-y border-r border-amber-300 bg-amber-50 text-amber-900 font-semibold",
  navIdle: lightSurface.navIdle,
  btnPrimary:
    "rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50",
  statAmber: lightSurface.statAmber,
  statEmerald: lightSurface.statEmerald,
  statRose: lightSurface.statRose,
  statSky: lightSurface.statSky,
  statViolet: lightSurface.statViolet,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  chartPanel: lightSurface.chartPanel,
  kpiStrip: lightSurface.kpiStrip,
  input:
    "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/15",
  btnGhost: lightSurface.btnGhost,
  listRow: lightSurface.listRow
} as const;

/** @deprecated use salesNeu — kept for gradual migration */
export const salesWs = {
  workspace: "sales-fullscreen sales-neu",
  canvas: salesNeu.canvas,
  navActive: salesNeu.navActive,
  navIdle: salesNeu.navIdle,
  statRow: "grid grid-cols-2 gap-x-6 gap-y-4 border-b border-sky-100 pb-6 sm:grid-cols-4",
  toolRow:
    "flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 py-4 transition-colors hover:bg-brand/5",
  scheduleBanner: "mb-6 border-b border-sky-200 pb-6"
} as const;
