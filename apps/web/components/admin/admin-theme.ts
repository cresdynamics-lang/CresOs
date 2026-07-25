/**
 * Admin workspace — GemMatrix-style enterprise console.
 * Dark charcoal sidebar · light canvas · pine teal accent · multi-color charts.
 */
export const adminPalette = {
  sidebar: "#1C1F2E",
  sidebarHover: "#2A2E3D",
  sidebarActive: "#343741",
  canvas: "#F4F7F9",
  card: "#FFFFFF",
  stroke: "#E5E9EF",
  text: "#1A1D26",
  textSecondary: "#5B6472",
  textMuted: "#8B93A1",
  teal: "#2D5A5A",
  tealHover: "#244848",
  chartGreen: "#7BB45D",
  chartOrange: "#F8B042",
  chartBlue: "#2067B0",
  chartPurple: "#AF52BF",
  chartTeal: "#4DB6AC",
  chartRed: "#E85D5D",
  success: "#2E7D4F",
  danger: "#C62828"
} as const;

export const adminNeu = {
  workspace: "admin-neu font-body",
  canvas: "bg-[#F4F7F9] text-[#1A1D26]",

  // Surfaces — white cards on soft gray
  panel:
    "rounded-xl border border-[#E5E9EF] bg-white p-4 shadow-[0_1px_3px_rgba(28,31,46,0.06)] sm:p-5",
  panelInset: "rounded-xl border border-[#E5E9EF] bg-[#F4F7F9] p-3 sm:p-4",
  card: "rounded-xl border border-[#E5E9EF] bg-white shadow-[0_1px_3px_rgba(28,31,46,0.06)]",
  chartPanel:
    "flex min-h-[min(18rem,38vh)] w-full flex-col rounded-xl border border-[#E5E9EF] bg-white p-5 shadow-[0_1px_3px_rgba(28,31,46,0.06)] sm:p-6",
  kpiStrip: "rounded-xl border border-[#E5E9EF] bg-white p-4 sm:p-5",
  commandBar:
    "flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E9EF] bg-white px-3 py-3 sm:px-4",
  listRow:
    "rounded-lg border border-[#E5E9EF] bg-white px-3 py-2.5 transition-colors hover:border-[#2D5A5A]/35 hover:bg-[#F4F7F9]",

  // Sidebar nav (dark)
  navIdle:
    "border border-transparent text-[#C8CDD8] hover:bg-[#2A2E3D] hover:text-white",
  navActive: "bg-[#343741] font-semibold text-white shadow-[inset_3px_0_0_0_#FFFFFF]",

  // Content nav (light pages — segmented controls)
  segIdle:
    "rounded-lg border border-[#E5E9EF] bg-white px-3 py-1.5 text-sm font-semibold text-[#5B6472] hover:bg-[#F4F7F9]",
  segActive:
    "rounded-lg border border-[#2D5A5A] bg-[#2D5A5A] px-3 py-1.5 text-sm font-semibold text-white",

  // Buttons
  btnPrimary:
    "rounded-lg bg-[#2D5A5A] px-4 py-2.5 font-label text-sm font-semibold tracking-wide text-white shadow-sm hover:bg-[#244848] disabled:opacity-50",
  btnGhost:
    "rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 font-label text-sm font-semibold tracking-wide text-[#1A1D26] hover:bg-[#F4F7F9] disabled:opacity-50",
  btnSubtle:
    "rounded-lg px-2.5 py-1.5 font-label text-sm font-semibold text-[#1A1D26] hover:bg-[#E5E9EF] disabled:opacity-50",
  btnDanger:
    "rounded-lg border border-[#C62828] bg-white px-3 py-2.5 font-label text-sm font-semibold text-[#C62828] hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-40",

  // Forms
  input:
    "rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 font-body text-sm font-medium text-[#1A1D26] placeholder:text-[#8B93A1] focus:border-[#2D5A5A] focus:outline-none focus:ring-2 focus:ring-[#2D5A5A]/20",

  // Tables
  tableWrap:
    "overflow-x-auto rounded-xl border border-[#E5E9EF] bg-white shadow-[0_1px_3px_rgba(28,31,46,0.06)]",
  th: "border-b border-[#E5E9EF] bg-[#F4F7F9] px-3 py-3 text-left font-label text-[11px] font-bold uppercase tracking-[0.08em] text-[#5B6472]",
  td: "border-b border-[#F4F7F9] px-3 py-3.5 align-middle font-body text-sm text-[#1A1D26]",
  rowHover: "transition-colors hover:bg-[#F4F7F9]",

  // Badges
  badge:
    "inline-flex items-center gap-1 rounded-md border border-[#E5E9EF] bg-[#F4F7F9] px-2 py-0.5 font-label text-[11px] font-bold text-[#1A1D26]",
  badgeAccent:
    "inline-flex items-center gap-1 rounded-md border border-[#2D5A5A]/30 bg-[#E8F0F0] px-2 py-0.5 font-label text-[11px] font-bold text-[#2D5A5A]",
  badgeSuccess:
    "inline-flex items-center gap-1 rounded-md border border-[#A7D7B8] bg-[#E8F5EE] px-2 py-0.5 font-label text-[11px] font-bold text-[#2E7D4F]",
  badgeWarning:
    "inline-flex items-center gap-1 rounded-md border border-[#F8B042]/50 bg-[#FFF6E5] px-2 py-0.5 font-label text-[11px] font-bold text-[#9A6B12]",
  badgeDanger:
    "inline-flex items-center gap-1 rounded-md border border-[#F5B5B5] bg-[#FEF2F2] px-2 py-0.5 font-label text-[11px] font-bold text-[#C62828]",

  // Message bars
  alertInfo: "rounded-lg border border-[#D6E4F0] border-l-4 border-l-[#2067B0] bg-[#F0F6FC]",
  alertWarning: "rounded-lg border border-[#F8B042]/40 border-l-4 border-l-[#F8B042] bg-[#FFF6E5]",
  alertDanger: "rounded-lg border border-[#F5B5B5] border-l-4 border-l-[#C62828] bg-[#FEF2F2]",

  // Stat tiles
  statIndigo: "border-[#BFD4EA] bg-[#F0F6FC]",
  statEmerald: "border-[#C5E0C0] bg-[#F2F9EF]",
  statAmber: "border-[#F8B042]/40 bg-[#FFF6E5]",
  statRose: "border-[#F5B5B5] bg-[#FEF2F2]",
  statViolet: "border-[#E0BEE6] bg-[#F9F0FB]",

  chip: "inline-flex items-center gap-1 rounded-md border border-[#E5E9EF] bg-[#F4F7F9] px-1.5 py-0.5 font-label text-[10px] font-bold text-[#1A1D26]",
  divider: "border-[#E5E9EF]",
  eyebrow: "font-label text-[11px] font-bold uppercase tracking-[0.14em] text-[#5B6472]",
  title: "font-display text-[#1A1D26]",
  body: "font-body text-[#1A1D26]",
  muted: "font-body text-[#5B6472]",

  // Sidebar chrome
  sidebar: "bg-[#1C1F2E] text-[#C8CDD8]",
  sidebarBorder: "border-[#2A2E3D]",
  topBar: "border-b border-[#E5E9EF] bg-white"
} as const;
