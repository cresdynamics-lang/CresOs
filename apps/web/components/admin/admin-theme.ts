import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics Admin workspace (brand blue). */
export const adminNeu = {
  workspace: "admin-neu",
  canvas: lightSurface.canvas,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navIdle: lightSurface.navIdle,
  navActive:
    "border-l-[3px] border-l-brand border-y border-r border-brand/30 bg-brand/10 text-brand font-semibold",
  btnPrimary: lightSurface.btnPrimary,
  btnGhost: lightSurface.btnGhost,
  input: lightSurface.input,
  tableWrap: lightSurface.tableWrap,
  statIndigo: lightSurface.statIndigo,
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
  chip: "inline-flex items-center gap-1 rounded-md border border-sky-200 bg-[#f5f9fc] px-1.5 py-0.5 text-[10px] text-slate-700",
  divider: "border-sky-100",
  title: "text-slate-900",
  body: "text-slate-600",
  muted: "text-slate-500"
} as const;
