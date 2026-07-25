import { lightSurface } from "../workspace/workspace-light";

/** Cres Dynamics HR workspace (GemMatrix teal accent). */
export const hrNeu = {
  workspace: "hr-neu",
  canvas: lightSurface.canvas,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navIdle: lightSurface.navIdle,
  navActive:
    "border-l-[3px] border-l-brand border-y border-r border-brand/30 bg-brand/10 text-brand font-semibold",
  btnPrimary: lightSurface.btnPrimary,
  btnGhost: lightSurface.btnGhost,
  statRose: lightSurface.statRose,
  statEmerald: lightSurface.statEmerald,
  statViolet: lightSurface.statViolet,
  statAmber: lightSurface.statAmber,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  alertInfo: lightSurface.alertInfo,
  kpiStrip: "w-full border-y border-[#E5E9EF] bg-white py-4",
  pageHero: "border-b border-[#E5E9EF] bg-gradient-to-b from-brand-light/50 to-transparent",
  kpiBand: "border-y border-[#E5E9EF] bg-white",
  kpiCell:
    "border-b border-[#E5E9EF] px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-8",
  section: "border-b border-[#E5E9EF] py-6",
  chartZone:
    "flex min-h-[min(20rem,40vh)] flex-col border-b border-[#E5E9EF] bg-transparent py-6",
  dataBlock: "border-b border-[#E5E9EF]",
  listRow:
    "border-b border-[#E5E9EF] px-5 py-4 transition-colors hover:bg-brand/5 last:border-b-0 lg:px-8",
  tableWrap: "w-full overflow-x-auto",
  chartPanel:
    "flex min-h-[min(18rem,38vh)] w-full flex-col border-b border-[#E5E9EF] bg-transparent py-6",
  sidePanel:
    "relative z-20 flex h-full max-h-[100dvh] w-[17.5rem] max-w-[92vw] shrink-0 flex-col border-r border-[#E5E9EF] bg-white shadow-sm",
  sideHeader: "shrink-0 border-b border-[#E5E9EF] px-4 py-4",
  sideGroup: "rounded-xl border border-[#E5E9EF] bg-[#F4F7F9] p-1.5",
  sideNavIdle:
    "group relative flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left text-[#5B6472] transition-all touch-manipulation hover:bg-brand/5 hover:text-brand",
  sideNavActive:
    "group relative flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-2.5 py-2.5 text-left text-brand",
  sideIconIdle:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E9EF] bg-white text-[#5B6472] transition-colors group-hover:text-brand",
  sideIconActive:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand-light text-brand",
  sideCta:
    "flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2.5 text-sm font-semibold text-brand transition-all hover:bg-brand/15"
} as const;
