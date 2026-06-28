/** Dark neumorphism tokens for the Sales workspace (amber accent) — mirrors finance layout. */
export const salesNeu = {
  workspace: "sales-neu",
  canvas: "bg-[#0b0f14]",
  shell:
    "rounded-2xl border border-white/[0.04] bg-[#121820] px-3 py-3 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:px-6 sm:py-4",
  panel:
    "rounded-2xl border border-white/[0.04] bg-[#121820] p-4 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-5",
  panelInset:
    "rounded-xl border border-white/[0.03] bg-[#0e1319] p-3 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-4",
  navActive:
    "bg-[#121820] text-amber-300 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.04)] border border-amber-500/20",
  navIdle:
    "border border-transparent text-slate-400 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-3px_-3px_8px_rgba(255,255,255,0.03)] hover:text-slate-200 hover:shadow-[5px_5px_12px_rgba(0,0,0,0.4),-3px_-3px_10px_rgba(255,255,255,0.04)]",
  btnPrimary:
    "rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(245,158,11,0.15)] hover:from-amber-500 hover:to-orange-600 active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.5)]",
  statAmber:
    "border-amber-500/15 bg-[#1a1610] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(245,158,11,0.06)]",
  statEmerald:
    "border-emerald-500/15 bg-[#101a16] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(16,185,129,0.06)]",
  statRose:
    "border-rose-500/15 bg-[#1a1014] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(244,63,94,0.06)]",
  statSky:
    "border-sky-500/15 bg-[#10141a] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(56,189,248,0.06)]",
  statViolet:
    "border-violet-500/15 bg-[#14101a] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(139,92,246,0.06)]",
  alertWarning:
    "rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-950/50 via-[#121820] to-[#0e1319] shadow-[6px_6px_14px_rgba(0,0,0,0.45)]",
  alertDanger:
    "rounded-2xl border border-rose-500/35 bg-gradient-to-br from-rose-950/40 via-[#121820] to-[#0e1319] shadow-[6px_6px_14px_rgba(0,0,0,0.45)]"
} as const;

/** @deprecated use salesNeu — kept for gradual migration */
export const salesWs = {
  workspace: "sales-fullscreen sales-neu",
  canvas: salesNeu.canvas,
  navActive: salesNeu.navActive,
  navIdle: salesNeu.navIdle,
  statRow: "grid grid-cols-2 gap-x-6 gap-y-4 border-b border-white/[0.06] pb-6 sm:grid-cols-4",
  toolRow:
    "flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] py-4 transition-colors hover:bg-white/[0.02]",
  scheduleBanner: "mb-6 border-b border-sky-500/20 pb-6"
} as const;
