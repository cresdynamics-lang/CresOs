import { lightSurface } from "../workspace/workspace-light";

/** Cres Dynamics Developer workspace (GemMatrix teal accent). */
export const devNeu = {
  workspace: "developer-neu",
  canvas: lightSurface.canvas,
  shell: lightSurface.shell,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navActive:
    "border-l-[3px] border-l-brand border-y border-r border-brand/30 bg-brand/10 text-brand font-semibold",
  navIdle: lightSurface.navIdle,
  listRow: lightSurface.listRow,
  input: `w-full ${lightSurface.input}`,
  inputReadonly:
    "w-full rounded-xl border border-[#E5E9EF] bg-[#F4F7F9] px-3 py-2.5 text-sm text-[#5B6472]",
  btnPrimary: lightSurface.btnPrimary,
  btnGhost: lightSurface.btnGhost,
  statViolet: lightSurface.statViolet,
  statEmerald: lightSurface.statEmerald,
  statRose: lightSurface.statRose,
  statSky: lightSurface.statSky,
  statAmber: lightSurface.statAmber,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  alertInfo: lightSurface.alertInfo,
  chartPanel: lightSurface.chartPanel,
  kpiStrip: lightSurface.kpiStrip
} as const;
