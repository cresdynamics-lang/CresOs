import { adminNeu, adminAccents } from "../admin/admin-theme";

/**
 * Director workspace — match Admin Fluent feel on overview:
 * white canvas, solid accent borders, no washes/gradients on cards.
 */
export const directorNeu = {
  workspace: "director-neu font-body",
  canvas: "bg-white text-[#242424]",
  panel: adminNeu.panel,
  panelInset: adminNeu.panelInset,
  navIdle: "border border-transparent text-[#5B6472] hover:bg-[#F5F5F5] hover:text-[#005CAB]",
  navActive:
    "border-l-[3px] border-l-[#005CAB] border-y border-r border-[#B4CDE8] bg-white text-[#005CAB] font-semibold",
  btnPrimary: adminNeu.btnPrimary,
  btnGhost: adminNeu.btnGhost,
  statSky: adminNeu.statIndigo,
  statEmerald: adminNeu.statEmerald,
  statAmber: adminNeu.statAmber,
  statRose: adminNeu.statRose,
  statViolet: adminNeu.statViolet,
  alertWarning: adminNeu.alertWarning,
  alertDanger: adminNeu.alertDanger,
  alertInfo: adminNeu.alertInfo,
  chartPanel: adminNeu.chartPanel,
  kpiStrip: adminNeu.kpiStrip,
  listRow: adminNeu.listRow,
  pageHero: "border-b border-[#E1DFDD] bg-white",
  section: "border-b border-[#E1DFDD] py-6",
  dataBlock: "border-b border-[#E1DFDD] px-5 py-4 last:border-b-0 lg:px-8",
  input: adminNeu.input,
  eyebrow: adminNeu.eyebrow,
  title: adminNeu.title,
  body: adminNeu.body,
  muted: adminNeu.muted,
  sectionTitle: "font-display text-[13px] font-semibold tracking-tight text-[#242424]",
  quickLink: adminNeu.segIdle,
  /** Active quick-link / toggle */
  quickLinkActive: adminNeu.segActive
} as const;

export { adminAccents };
