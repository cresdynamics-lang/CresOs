import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics PM workspace (teal accent). */
export const pmNeu = {
  workspace: "pm-neu",
  canvas: lightSurface.canvas,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navIdle: lightSurface.navIdle,
  navActive:
    "border-l-[3px] border-l-teal-600 border-y border-r border-teal-300 bg-teal-50 text-teal-900 font-semibold",
  btnPrimary:
    "rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50",
  btnGhost: lightSurface.btnGhost,
  alertWarning: lightSurface.alertWarning,
  alertInfo: "rounded-xl border border-teal-200 bg-teal-50 shadow-sm",
  pageHero: "border-b border-sky-100 bg-gradient-to-b from-teal-50/80 to-transparent",
  kpiBand: "border-y border-sky-100 bg-white/70",
  kpiCell:
    "border-b border-sky-100 px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-8",
  section: "border-b border-sky-100 py-6",
  dataBlock: "border-b border-sky-100",
  listRow:
    "border-b border-sky-100 px-5 py-4 transition-colors hover:bg-brand/5 last:border-b-0 lg:px-8",
  sidePanel:
    "relative z-20 flex h-full max-h-[100dvh] w-[17.5rem] max-w-[92vw] shrink-0 flex-col border-r border-sky-200 bg-white shadow-sm",
  sideHeader: "shrink-0 border-b border-sky-200 px-4 py-4",
  sideGroup: "rounded-xl border border-sky-100 bg-[#f5f9fc] p-1.5",
  sideNavIdle:
    "group relative flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left text-slate-600 transition-all touch-manipulation hover:bg-brand/5 hover:text-brand",
  sideNavActive:
    "group relative flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-2.5 text-left text-teal-900",
  sideIconIdle:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-white text-slate-500 transition-colors group-hover:text-teal-600",
  sideIconActive:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-100 text-teal-700",
  sideCta:
    "flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-800 transition-all hover:bg-teal-100",
  chartPanel: lightSurface.chartPanel,
  kpiStrip: lightSurface.kpiStrip,
  statEmerald: lightSurface.statEmerald,
  statAmber: lightSurface.statAmber,
  statRose: lightSurface.statRose,
  statSky: lightSurface.statSky,
  statViolet: lightSurface.statViolet,
  alertDanger: lightSurface.alertDanger
} as const;
