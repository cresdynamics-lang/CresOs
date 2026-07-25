/**
 * Admin workspace surfaces — Microsoft 365 admin-center feel.
 * Neutral gray canvas, crisp 1px strokes, high-contrast text, brand-blue accent.
 * Text ramp: #242424 primary · #424242 secondary · #616161 tertiary.
 */
export const adminNeu = {
  workspace: "admin-neu",
  canvas: "bg-[#faf9f8] text-[#242424]",

  // Surfaces
  panel: "rounded-lg border border-[#e1dfdd] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.08)] sm:p-5",
  panelInset: "rounded-lg border border-[#e1dfdd] bg-[#f5f5f5] p-3 sm:p-4",
  card: "rounded-lg border border-[#e1dfdd] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
  chartPanel:
    "flex min-h-[min(18rem,38vh)] w-full flex-col rounded-lg border border-[#e1dfdd] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.08)] sm:p-6",
  kpiStrip: "rounded-lg border border-[#e1dfdd] bg-[#f5f5f5] p-4 sm:p-5",
  commandBar:
    "flex flex-wrap items-center justify-between gap-2 border-b border-[#e1dfdd] bg-white px-3 py-2.5 sm:px-4",
  listRow:
    "rounded-md border border-[#e1dfdd] bg-white px-3 py-2.5 transition-colors hover:border-brand/40 hover:bg-[#f3f8ff]",

  // Navigation
  navIdle: "border border-transparent text-[#242424] hover:bg-[#f0f0f0] hover:text-[#242424]",
  navActive: "border-l-[3px] border-l-brand bg-[#ebf3fc] font-semibold text-[#0b4a8f]",

  // Buttons
  btnPrimary:
    "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:bg-brand-dark disabled:opacity-50",
  btnGhost:
    "rounded-md border border-[#8a8886] bg-white px-3 py-2 text-sm font-semibold text-[#242424] hover:bg-[#f0f0f0] disabled:opacity-50",
  btnSubtle:
    "rounded-md px-2.5 py-1.5 text-sm font-semibold text-[#242424] hover:bg-[#f0f0f0] disabled:opacity-50",
  btnDanger:
    "rounded-md border border-[#d13438] bg-white px-3 py-2 text-sm font-semibold text-[#a4262c] hover:bg-[#fdf3f4] disabled:cursor-not-allowed disabled:opacity-40",

  // Forms
  input:
    "rounded-md border border-[#8a8886] bg-white px-3 py-2 text-sm font-medium text-[#242424] placeholder:text-[#616161] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",

  // Tables (DetailsList)
  tableWrap: "overflow-x-auto rounded-lg border border-[#e1dfdd] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
  th: "border-b border-[#d1d1d1] bg-[#faf9f8] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#424242]",
  td: "border-b border-[#f0f0f0] px-3 py-3 align-middle text-[#242424]",
  rowHover: "transition-colors hover:bg-[#f3f8ff]",

  // Badges
  badge:
    "inline-flex items-center gap-1 rounded border border-[#d1d1d1] bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-semibold text-[#242424]",
  badgeAccent:
    "inline-flex items-center gap-1 rounded border border-brand/35 bg-[#ebf3fc] px-2 py-0.5 text-[11px] font-semibold text-[#0b4a8f]",
  badgeSuccess:
    "inline-flex items-center gap-1 rounded border border-[#9fd5a1] bg-[#e7f6e8] px-2 py-0.5 text-[11px] font-semibold text-[#0b5c15]",
  badgeWarning:
    "inline-flex items-center gap-1 rounded border border-[#f0c987] bg-[#fff8e6] px-2 py-0.5 text-[11px] font-semibold text-[#8a5300]",

  // Message bars
  alertInfo: "rounded border border-[#e1dfdd] border-l-4 border-l-brand bg-[#f3f8ff]",
  alertWarning: "rounded border border-[#e1dfdd] border-l-4 border-l-[#f7630c] bg-[#fff8f2]",
  alertDanger: "rounded border border-[#e1dfdd] border-l-4 border-l-[#d13438] bg-[#fdf3f4]",

  // Stat tiles
  statIndigo: "border-[#c7d8f0] bg-[#eff5fd]",
  statEmerald: "border-[#9fd5a1] bg-[#e7f6e8]",
  statAmber: "border-[#f0c987] bg-[#fff8e6]",
  statRose: "border-[#f1b4b6] bg-[#fdf3f4]",
  statViolet: "border-[#d3c4ee] bg-[#f5f0fd]",

  // Text ramp
  chip: "inline-flex items-center gap-1 rounded border border-[#d1d1d1] bg-[#f5f5f5] px-1.5 py-0.5 text-[10px] font-semibold text-[#242424]",
  divider: "border-[#e1dfdd]",
  title: "text-[#242424]",
  body: "text-[#424242]",
  muted: "text-[#616161]"
} as const;
