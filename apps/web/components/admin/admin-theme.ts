/**
 * Admin workspace — white canvas with deep solid accent colours.
 * Blue · green · yellow · red · purple — solid fills, no fades/gradients.
 */
export const adminPalette = {
  sidebar: "#1C1F2E",
  sidebarHover: "#2A2E3D",
  sidebarActive: "#343741",
  canvas: "#FFFFFF",
  card: "#FFFFFF",
  stroke: "#E1DFDD",
  text: "#242424",
  textSecondary: "#605E5C",
  textMuted: "#8A8886",
  /** Deep solid accents */
  blue: "#005CAB",
  green: "#0B6A0B",
  yellow: "#C19C00",
  red: "#C50F1F",
  purple: "#5C2D91",
  teal: "#005CAB",
  tealHover: "#004A8C",
  chartGreen: "#0B6A0B",
  chartOrange: "#C19C00",
  chartBlue: "#005CAB",
  chartPurple: "#5C2D91",
  chartTeal: "#0078A8",
  chartRed: "#C50F1F",
  success: "#0B6A0B",
  danger: "#C50F1F"
} as const;

export type AdminAccent = "blue" | "green" | "yellow" | "red" | "purple";

export const adminAccents: Record<
  AdminAccent,
  { solid: string; border: string; label: string }
> = {
  blue: { solid: "#005CAB", border: "#B4CDE8", label: "Blue" },
  green: { solid: "#0B6A0B", border: "#A8D5A8", label: "Green" },
  yellow: { solid: "#C19C00", border: "#E8D48A", label: "Yellow" },
  red: { solid: "#C50F1F", border: "#E8A0A6", label: "Red" },
  purple: { solid: "#5C2D91", border: "#C5B0DF", label: "Purple" }
};

/** Soft elevation — white cards */
const fluentCardShadow =
  "shadow-[0_0.3px_0.9px_rgba(0,0,0,0.08),0_1.6px_3.6px_rgba(0,0,0,0.08)]";
const fluentCardHover =
  "hover:shadow-[0_0.6px_1.8px_rgba(0,0,0,0.1),0_3.2px_7.2px_rgba(0,0,0,0.1)]";

export const adminNeu = {
  workspace: "admin-neu font-body",
  canvas: "bg-white text-[#242424]",

  panel: `rounded-lg border border-[#E1DFDD] bg-white p-4 ${fluentCardShadow} sm:p-5`,
  panelInset: `rounded-lg border border-[#E1DFDD] bg-white p-3 sm:p-4 ${fluentCardShadow}`,
  card: `rounded-lg border border-[#E1DFDD] bg-white ${fluentCardShadow}`,
  chartPanel: `relative flex min-h-[min(16rem,36vh)] w-full flex-col overflow-hidden rounded-lg border border-[#E1DFDD] bg-white p-4 pt-5 ${fluentCardShadow} sm:p-5 sm:pt-5`,
  kpiStrip: "bg-transparent p-0",
  commandBar:
    "flex flex-wrap items-center justify-between gap-2 border-b border-[#E1DFDD] bg-white px-3 py-3 sm:px-4",
  listRow: `rounded-lg border border-[#E1DFDD] bg-white px-3 py-2.5 transition-shadow ${fluentCardHover}`,

  cardInteractive: [
    "rounded-lg border border-[#E1DFDD] bg-white text-left",
    fluentCardShadow,
    "transition-[box-shadow,transform] duration-150",
    fluentCardHover,
    "hover:-translate-y-px",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#005CAB]/35"
  ].join(" "),

  navIdle:
    "border border-transparent text-[#C8CDD8] hover:bg-[#2A2E3D] hover:text-white",
  navActive: "bg-[#343741] font-semibold text-white shadow-[inset_3px_0_0_0_#FFFFFF]",

  segIdle:
    "rounded-md border border-[#E1DFDD] bg-white px-3 py-1.5 text-sm font-semibold text-[#605E5C] hover:bg-[#F5F5F5]",
  segActive:
    "rounded-md border border-[#005CAB] bg-[#005CAB] px-3 py-1.5 text-sm font-semibold text-white",

  btnPrimary:
    "rounded-md bg-[#005CAB] px-4 py-2.5 font-label text-sm font-semibold tracking-wide text-white shadow-sm hover:bg-[#004A8C] disabled:opacity-50",
  btnGhost:
    "rounded-md border border-[#D1D1D1] bg-white px-3 py-2.5 font-label text-sm font-semibold tracking-wide text-[#242424] hover:bg-[#F5F5F5] disabled:opacity-50",
  btnSubtle:
    "rounded-md px-2.5 py-1.5 font-label text-sm font-semibold text-[#242424] hover:bg-[#F5F5F5] disabled:opacity-50",
  btnDanger:
    "rounded-md border border-[#C50F1F] bg-white px-3 py-2.5 font-label text-sm font-semibold text-[#C50F1F] hover:bg-[#FDF3F4] disabled:cursor-not-allowed disabled:opacity-40",

  input:
    "rounded-md border border-[#D1D1D1] bg-white px-3 py-2.5 font-body text-sm font-medium text-[#242424] placeholder:text-[#8A8886] focus:border-[#005CAB] focus:outline-none focus:ring-2 focus:ring-[#005CAB]/20",

  tableWrap: `overflow-x-auto rounded-lg border border-[#E1DFDD] bg-white ${fluentCardShadow}`,
  th: "border-b border-[#E1DFDD] bg-white px-3 py-3 text-left font-label text-[11px] font-bold uppercase tracking-[0.08em] text-[#605E5C]",
  td: "border-b border-[#F5F5F5] px-3 py-3.5 align-middle font-body text-sm text-[#242424]",
  rowHover: "transition-colors hover:bg-[#FAFAFA]",

  badge:
    "inline-flex items-center gap-1 rounded-md border border-[#E1DFDD] bg-white px-2 py-0.5 font-label text-[11px] font-bold text-[#242424]",
  badgeAccent:
    "inline-flex items-center gap-1 rounded-md border border-[#005CAB] bg-white px-2 py-0.5 font-label text-[11px] font-bold text-[#005CAB]",
  badgeSuccess:
    "inline-flex items-center gap-1 rounded-md border border-[#0B6A0B] bg-white px-2 py-0.5 font-label text-[11px] font-bold text-[#0B6A0B]",
  badgeWarning:
    "inline-flex items-center gap-1 rounded-md border border-[#C19C00] bg-white px-2 py-0.5 font-label text-[11px] font-bold text-[#8A7000]",
  badgeDanger:
    "inline-flex items-center gap-1 rounded-md border border-[#C50F1F] bg-white px-2 py-0.5 font-label text-[11px] font-bold text-[#C50F1F]",

  alertInfo: "rounded-md border border-[#005CAB] border-l-4 border-l-[#005CAB] bg-white",
  alertWarning: "rounded-md border border-[#C19C00] border-l-4 border-l-[#C19C00] bg-white",
  alertDanger: "rounded-md border border-[#C50F1F] border-l-4 border-l-[#C50F1F] bg-white",

  statIndigo: "border-[#E1DFDD] bg-white",
  statEmerald: "border-[#E1DFDD] bg-white",
  statAmber: "border-[#E1DFDD] bg-white",
  statRose: "border-[#E1DFDD] bg-white",
  statViolet: "border-[#E1DFDD] bg-white",

  chip: "inline-flex items-center gap-1 rounded-md border border-[#E1DFDD] bg-white px-1.5 py-0.5 font-label text-[10px] font-bold text-[#242424]",
  divider: "border-[#E1DFDD]",
  eyebrow: "font-label text-[11px] font-bold uppercase tracking-[0.14em] text-[#605E5C]",
  title: "font-display text-[#242424]",
  body: "font-body text-[#242424]",
  muted: "font-body text-[#605E5C]",

  sidebar: "bg-[#1C1F2E] text-[#C8CDD8]",
  sidebarBorder: "border-[#2A2E3D]",
  topBar: "border-b border-[#E1DFDD] bg-white"
} as const;
