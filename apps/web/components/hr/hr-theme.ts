import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics HR workspace (rose accent). */
export const hrNeu = {
  workspace: "hr-neu",
  canvas: lightSurface.canvas,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navIdle: lightSurface.navIdle,
  navActive:
    "border-l-[3px] border-l-rose-600 border-y border-r border-rose-300 bg-rose-50 text-rose-900 font-semibold",
  btnPrimary:
    "rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50",
  btnGhost: lightSurface.btnGhost,
  statRose: lightSurface.statRose,
  statEmerald: lightSurface.statEmerald,
  statViolet: lightSurface.statViolet,
  statAmber: lightSurface.statAmber,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  alertInfo: "rounded-xl border border-rose-200 bg-rose-50 shadow-sm",
  kpiStrip: "w-full border-y border-sky-100 bg-white/70 py-4",
  pageHero: "border-b border-sky-100 bg-gradient-to-b from-rose-50/80 to-transparent",
  kpiBand: "border-y border-sky-100 bg-white/70",
  kpiCell:
    "border-b border-sky-100 px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-8",
  section: "border-b border-sky-100 py-6",
  chartZone:
    "flex min-h-[min(20rem,40vh)] flex-col border-b border-sky-100 bg-transparent py-6",
  dataBlock: "border-b border-sky-100",
  listRow:
    "border-b border-sky-100 px-5 py-4 transition-colors hover:bg-brand/5 last:border-b-0 lg:px-8",
  tableWrap: "w-full overflow-x-auto",
  chartPanel:
    "flex min-h-[min(18rem,38vh)] w-full flex-col border-b border-sky-100 bg-transparent py-6",
  sidePanel:
    "relative z-20 flex h-full max-h-[100dvh] w-[17.5rem] max-w-[92vw] shrink-0 flex-col border-r border-sky-200 bg-white shadow-sm",
  sideHeader: "shrink-0 border-b border-sky-200 px-4 py-4",
  sideGroup: "rounded-xl border border-sky-100 bg-[#f5f9fc] p-1.5",
  sideNavIdle:
    "group relative flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left text-slate-600 transition-all touch-manipulation hover:bg-brand/5 hover:text-brand",
  sideNavActive:
    "group relative flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2.5 text-left text-rose-900",
  sideIconIdle:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-white text-slate-500 transition-colors group-hover:text-rose-600",
  sideIconActive:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-100 text-rose-700",
  sideCta:
    "flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-800 transition-all hover:bg-rose-100"
} as const;
