/**
 * Shared bright Cres Dynamics workspace surfaces.
 * Brand: #1F6FEB · light fill #E0ECFF · canvas soft sky.
 */
export const lightSurface = {
  canvas: "bg-[#eef4fb] text-slate-800",
  shell:
    "rounded-2xl border border-sky-200/80 bg-white px-3 py-3 shadow-sm sm:px-6 sm:py-4",
  panel: "rounded-2xl border border-sky-200/80 bg-white p-4 shadow-sm sm:p-5",
  panelInset: "rounded-xl border border-sky-100 bg-[#f5f9fc] p-3 sm:p-4",
  listRow:
    "rounded-xl border border-sky-100 bg-[#f8fbfe] px-3 py-2.5 transition-colors hover:border-brand/35",
  kpiStrip: "rounded-xl border border-sky-100 bg-[#f5f9fc] p-4 sm:p-5",
  tableWrap: "overflow-x-auto rounded-xl border border-sky-200/80 bg-white shadow-sm",
  chartPanel:
    "flex min-h-[min(18rem,38vh)] w-full flex-col rounded-2xl border border-sky-200/80 bg-white p-5 shadow-sm sm:p-6",
  navIdle: "border border-transparent text-slate-600 hover:bg-brand/5 hover:text-brand",
  btnPrimary:
    "rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark disabled:opacity-50",
  btnGhost:
    "rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand/40 hover:text-brand disabled:opacity-50",
  input:
    "rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/15",
  alertWarning: "rounded-xl border border-amber-200 bg-amber-50 shadow-sm",
  alertDanger: "rounded-xl border border-rose-300 bg-rose-100 shadow-sm",
  alertInfo: "rounded-xl border border-sky-300 bg-sky-100 shadow-sm",
  statBrand: "border-brand/25 bg-brand-light/60",
  statEmerald: "border-emerald-300 bg-emerald-100",
  statAmber: "border-amber-300 bg-amber-100",
  statRose: "border-rose-300 bg-rose-100",
  statViolet: "border-violet-300 bg-violet-100",
  statSky: "border-sky-300 bg-sky-100",
  statIndigo: "border-indigo-300 bg-indigo-100",
  statTeal: "border-teal-300 bg-teal-100"
} as const;
