/** Dark neumorphism tokens for the main command-center dashboard (brand accent). */
export const dashboardNeu = {
  canvas: "bg-[#0b0f14]",
  hero:
    "relative overflow-hidden rounded-3xl border border-white/[0.05] bg-[#0e1319] p-5 shadow-[8px_8px_20px_rgba(0,0,0,0.55),-6px_-6px_16px_rgba(255,255,255,0.04)] sm:p-7",
  heroGlow:
    "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl",
  panel:
    "rounded-2xl border border-white/[0.04] bg-[#121820] p-4 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-5",
  panelInset:
    "rounded-xl border border-white/[0.03] bg-[#0e1319] p-3 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-4",
  kpiTile:
    "group relative flex min-h-[6.25rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.04] bg-[#10161e] p-4 shadow-[5px_5px_14px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(255,255,255,0.03)] transition-all hover:border-white/[0.07] hover:shadow-[6px_6px_16px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)]",
  kpiTileActive:
    "border-brand/25 shadow-[5px_5px_14px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(31,111,235,0.08)]",
  kpiGrid: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
  queueEmpty:
    "flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3.5 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.35)]",
  queueItem:
    "rounded-xl border border-white/[0.04] bg-[#10161e] px-4 py-3 shadow-[4px_4px_10px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(255,255,255,0.03)]",
  btnGhost:
    "rounded-xl border border-white/[0.06] bg-[#121820] px-3 py-2 text-xs font-medium text-slate-200 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-white active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)] disabled:opacity-50 sm:text-sm",
  btnPrimary:
    "rounded-xl bg-gradient-to-br from-brand to-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(31,111,235,0.2)] hover:from-sky-500 hover:to-brand active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.5)]",
  tasksStrip:
    "flex flex-col gap-3 rounded-xl border border-white/[0.04] bg-[#0e1319] px-4 py-3.5 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.45),inset_-2px_-2px_8px_rgba(255,255,255,0.02)] sm:flex-row sm:items-center sm:justify-between",
  eyebrow: "font-label text-[10px] font-semibold uppercase tracking-[0.24em] text-brand/90"
} as const;
