import { lightSurface } from "../workspace/workspace-light";

/** Cres Dynamics Finance workspace (GemMatrix teal accent). */
export const financeNeu = {
  workspace: "finance-neu",
  canvas: lightSurface.canvas,
  shell: lightSurface.shell,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  listRow: lightSurface.listRow,
  navActive:
    "border-l-[3px] border-l-brand border-y border-r border-brand/30 bg-brand/10 text-brand font-semibold",
  navIdle: lightSurface.navIdle,
  input: lightSurface.input,
  btnPrimary: lightSurface.btnPrimary,
  btnGhost: lightSurface.btnGhost,
  statEmerald: lightSurface.statEmerald,
  statAmber: lightSurface.statAmber,
  statRose: lightSurface.statRose,
  statViolet: lightSurface.statViolet,
  tableWrap: lightSurface.tableWrap,
  alertWarning: lightSurface.alertWarning,
  alertDanger: lightSurface.alertDanger,
  alertInfo: lightSurface.alertInfo,
  kpiStrip: lightSurface.kpiStrip
} as const;
