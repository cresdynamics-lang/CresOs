import { lightSurface } from "../workspace/workspace-light";

/** Cres Dynamics Sales workspace (GemMatrix teal accent). */
export const salesNeu = {
  workspace: "sales-neu",
  canvas: lightSurface.canvas,
  shell: lightSurface.shell,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navActive:
    "border-l-[3px] border-l-brand border-y border-r border-brand/30 bg-brand/10 text-brand font-semibold",
  navIdle: lightSurface.navIdle,
  btnPrimary: lightSurface.btnPrimary,
  statAmber: lightSurface.statAmber,
  statEmerald: lightSurface.statEmerald,
  statRose: lightSurface.statRose,
  statSky: lightSurface.statSky,
  statViolet: lightSurface.statViolet,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  chartPanel: lightSurface.chartPanel,
  kpiStrip: lightSurface.kpiStrip,
  input: `w-full ${lightSurface.input}`,
  btnGhost: lightSurface.btnGhost,
  listRow: lightSurface.listRow
} as const;

/** @deprecated use salesNeu — kept for gradual migration */
export const salesWs = {
  workspace: "sales-fullscreen sales-neu",
  canvas: salesNeu.canvas,
  navActive: salesNeu.navActive,
  navIdle: salesNeu.navIdle,
  statRow: "grid grid-cols-2 gap-x-6 gap-y-4 border-b border-[#E5E9EF] pb-6 sm:grid-cols-4",
  toolRow:
    "flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E9EF] py-4 transition-colors hover:bg-brand/5",
  scheduleBanner: "mb-6 border-b border-[#E5E9EF] pb-6"
} as const;
