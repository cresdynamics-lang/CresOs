/**
 * Shared Cres Dynamics workspace surfaces — GemMatrix system.
 * Brand: pine teal #2D5A5A · light fill #E8F0F0 · canvas #F4F7F9 · cards white.
 */
export const lightSurface = {
  canvas: "bg-[#F4F7F9] text-[#1A1D26]",
  shell:
    "rounded-2xl border border-[#E5E9EF] bg-white px-3 py-3 shadow-[0_1px_3px_rgba(28,31,46,0.06)] sm:px-6 sm:py-4",
  panel:
    "rounded-2xl border border-[#E5E9EF] bg-white p-4 shadow-[0_1px_3px_rgba(28,31,46,0.06)] sm:p-5",
  panelInset: "rounded-xl border border-[#E5E9EF] bg-[#F4F7F9] p-3 sm:p-4",
  listRow:
    "rounded-xl border border-[#E5E9EF] bg-white px-3 py-2.5 transition-colors hover:border-brand/35 hover:bg-[#F4F7F9]",
  kpiStrip: "rounded-xl border border-[#E5E9EF] bg-white p-4 sm:p-5",
  tableWrap:
    "overflow-x-auto rounded-xl border border-[#E5E9EF] bg-white shadow-[0_1px_3px_rgba(28,31,46,0.06)]",
  chartPanel:
    "flex min-h-[min(18rem,38vh)] w-full flex-col rounded-2xl border border-[#E5E9EF] bg-white p-5 shadow-[0_1px_3px_rgba(28,31,46,0.06)] sm:p-6",
  navIdle: "border border-transparent text-[#5B6472] hover:bg-brand/5 hover:text-brand",
  btnPrimary:
    "rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50",
  btnGhost:
    "rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#1A1D26] hover:border-brand/40 hover:text-brand disabled:opacity-50",
  input:
    "rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#1A1D26] shadow-sm placeholder:text-[#8B93A1] focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/15",
  alertWarning: "rounded-xl border border-[#F8B042]/40 bg-[#FFF6E5] shadow-sm",
  alertDanger: "rounded-xl border border-[#F5B5B5] bg-[#FEF2F2] shadow-sm",
  alertInfo: "rounded-xl border border-[#D6E4F0] bg-[#F0F6FC] shadow-sm",
  statBrand: "border-brand/25 bg-brand-light/60",
  statEmerald: "border-[#C5E0C0] bg-[#F2F9EF]",
  statAmber: "border-[#F8B042]/40 bg-[#FFF6E5]",
  statRose: "border-[#F5B5B5] bg-[#FEF2F2]",
  statViolet: "border-[#E0BEE6] bg-[#F9F0FB]",
  statSky: "border-[#BFD4EA] bg-[#F0F6FC]",
  statIndigo: "border-[#BFD4EA] bg-[#F0F6FC]",
  statTeal: "border-brand/25 bg-brand-light/60"
} as const;
