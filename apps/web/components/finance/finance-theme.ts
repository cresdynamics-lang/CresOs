import { lightSurface } from "../workspace/workspace-light";

/** Finance surfaces — plain system UI type (no display / label font flair). */
export const financeNeu = {
  workspace: "finance-neu",
  canvas: "bg-white text-[#242424] antialiased",
  shell: lightSurface.shell,
  panel:
    "relative overflow-hidden rounded-lg border border-[#E1DFDD] bg-white p-4 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)] sm:p-5",
  panelInset: "rounded-lg border border-[#E1DFDD] bg-white p-3 sm:p-4",
  listRow:
    "rounded-lg border border-[#E1DFDD] bg-white px-3 py-2.5 transition-colors hover:border-[#005CAB]/40",
  navActive:
    "border-l-[3px] border-l-[#005CAB] border-y border-r border-[#B4CDE8] bg-white text-[#005CAB] font-semibold",
  navIdle: lightSurface.navIdle,
  input:
    "rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm font-medium text-[#242424] shadow-sm placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20",
  btnPrimary:
    "rounded-md bg-[#005CAB] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#004A8C] disabled:opacity-50",
  btnGhost:
    "rounded-md border border-[#D1D1D1] bg-white px-3 py-2 text-sm font-semibold text-[#242424] hover:border-[#005CAB]/40 hover:text-[#005CAB] disabled:opacity-50",
  eyebrow: "text-[11px] font-semibold tracking-wide text-[#005CAB]",
  title: "text-2xl font-semibold tracking-tight text-[#242424] sm:text-3xl",
  titleSm: "text-xl font-semibold tracking-tight text-[#242424] sm:text-2xl",
  sectionTitle: "text-base font-semibold tracking-tight text-[#242424]",
  body: "text-sm font-medium leading-relaxed text-[#605E5C]",
  bodyStrong: "text-sm font-semibold text-[#242424]",
  muted: "text-xs font-medium text-[#8A8886]",
  tableHead: "text-[11px] font-semibold uppercase tracking-[0.04em] text-[#605E5C]",
  tableCell: "text-sm text-[#242424]",
  money: "tabular-nums font-semibold tracking-tight",
  statEmerald: "border-[#A8D5A8] bg-white",
  statAmber: "border-[#E8D48A] bg-white",
  statRose: "border-[#E8A0A6] bg-white",
  statViolet: "border-[#C5B0DF] bg-white",
  tableWrap:
    "overflow-x-auto rounded-lg border border-[#E1DFDD] bg-white shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]",
  alertWarning: "rounded-md border border-[#E8D48A] border-l-4 border-l-[#C19C00] bg-white",
  alertDanger: "rounded-md border border-[#E8A0A6] border-l-4 border-l-[#C50F1F] bg-white",
  alertInfo: "rounded-md border border-[#B4CDE8] border-l-4 border-l-[#005CAB] bg-white",
  kpiStrip: "bg-transparent p-0"
} as const;
