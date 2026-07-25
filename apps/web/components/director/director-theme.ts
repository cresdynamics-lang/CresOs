import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics Director workspace (sky / brand accent). */
export const directorNeu = {
  workspace: "director-neu",
  canvas: lightSurface.canvas,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navIdle: lightSurface.navIdle,
  navActive:
    "border-l-[3px] border-l-brand border-y border-r border-brand/30 bg-brand/10 text-brand font-semibold",
  btnPrimary: lightSurface.btnPrimary,
  btnGhost: lightSurface.btnGhost,
  statSky: lightSurface.statSky,
  statEmerald: lightSurface.statEmerald,
  statAmber: lightSurface.statAmber,
  statRose: lightSurface.statRose,
  statViolet: lightSurface.statViolet,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  alertInfo: lightSurface.alertInfo,
  chartPanel: lightSurface.chartPanel,
  kpiStrip: lightSurface.kpiStrip,
  listRow: lightSurface.listRow,
  pageHero: "border-b border-[#E5E9EF] bg-gradient-to-b from-brand-light/50 to-transparent",
  section: "border-b border-[#E5E9EF] py-6",
  dataBlock: "border-b border-[#E5E9EF] px-5 py-4 last:border-b-0 lg:px-8",
  input: lightSurface.input
} as const;
