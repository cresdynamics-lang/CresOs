import { lightSurface } from "../workspace/workspace-light";

/** Sales workspace — compact white Fluent UI (same system as developer). */
export const salesNeu = {
  workspace: "sales-neu",
  canvas: "bg-white text-[#242424] antialiased",
  shell: lightSurface.shell,
  panel:
    "relative overflow-hidden rounded-md border border-[#E1DFDD] bg-white p-3 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
  panelInset: "rounded-md border border-[#E1DFDD] bg-white p-2.5",
  navActive:
    "border-l-[3px] border-l-[#005CAB] border-y border-r border-[#B4CDE8] bg-white text-[#005CAB] font-semibold",
  navIdle: lightSurface.navIdle,
  listRow:
    "rounded-md border border-[#E1DFDD] bg-white px-2.5 py-1.5 transition-colors hover:border-[#005CAB]/40",
  input:
    "w-full rounded-md border border-[#D1D1D1] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#242424] shadow-sm placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20",
  inputReadonly:
    "w-full rounded-md border border-[#E1DFDD] bg-[#FAFAFA] px-2.5 py-1.5 text-[13px] text-[#605E5C]",
  btnPrimary:
    "rounded-md bg-[#005CAB] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#004A8C] disabled:opacity-50",
  btnGhost:
    "rounded-md border border-[#D1D1D1] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#242424] hover:border-[#005CAB]/40 hover:text-[#005CAB] disabled:opacity-50",
  eyebrow: "text-[10px] font-semibold tracking-wide text-[#005CAB]",
  title: "text-lg font-semibold tracking-tight text-[#242424] sm:text-xl",
  body: "text-[12px] font-medium leading-snug text-[#605E5C]",
  muted: "text-[11px] font-medium text-[#8A8886]",
  sectionTitle: "text-[13px] font-semibold tracking-tight text-[#242424]",
  chartPanel:
    "relative flex min-h-[9.5rem] w-full flex-col overflow-hidden rounded-md border border-[#E1DFDD] bg-white p-2.5 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] sm:p-3",
  kpiStrip: "bg-transparent p-0",
  alertWarning: "rounded-md border border-[#E8D48A] border-l-[3px] border-l-[#C19C00] bg-white",
  alertDanger: "rounded-md border border-[#E8A0A6] border-l-[3px] border-l-[#C50F1F] bg-white",
  alertInfo: "rounded-md border border-[#B4CDE8] border-l-[3px] border-l-[#005CAB] bg-white",
  statBrand: "border-[#B4CDE8] bg-white",
  statViolet: "border-[#C5B0DF] bg-white",
  statEmerald: "border-[#A8D5A8] bg-white",
  statRose: "border-[#E8A0A6] bg-white",
  statSky: "border-[#B4CDE8] bg-white",
  statAmber: "border-[#E8D48A] bg-white"
} as const;

/** @deprecated use salesNeu — kept for gradual migration */
export const salesWs = {
  workspace: "sales-fullscreen sales-neu",
  canvas: salesNeu.canvas,
  navActive: salesNeu.navActive,
  navIdle: salesNeu.navIdle,
  statRow: "grid grid-cols-2 gap-2 sm:grid-cols-4",
  toolRow:
    "flex flex-wrap items-center justify-between gap-2 border-b border-[#E1DFDD] py-3 transition-colors hover:bg-[#F5F5F5]",
  scheduleBanner: "mb-4 border-b border-[#E1DFDD] pb-4"
} as const;
