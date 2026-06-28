/** Dark neumorphism tokens for the Developer workspace (violet accent) — mirrors finance layout. */
export const devNeu = {
  workspace: "developer-neu",
  canvas: "bg-[#0b0f14]",
  shell:
    "rounded-2xl border border-white/[0.04] bg-[#121820] px-3 py-3 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:px-6 sm:py-4",
  panel:
    "rounded-2xl border border-white/[0.04] bg-[#121820] p-4 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-5",
  panelInset:
    "rounded-xl border border-white/[0.03] bg-[#0e1319] p-3 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-4",
  navActive:
    "bg-[#121820] text-violet-300 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.04)] border border-violet-500/20",
  navIdle:
    "border border-transparent text-slate-400 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-3px_-3px_8px_rgba(255,255,255,0.03)] hover:text-slate-200 hover:shadow-[5px_5px_12px_rgba(0,0,0,0.4),-3px_-3px_10px_rgba(255,255,255,0.04)]",
  listRow:
    "rounded-xl border border-white/[0.04] bg-[#10161e] px-3 py-2 shadow-[4px_4px_10px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(255,255,255,0.03)] transition-shadow hover:shadow-[5px_5px_12px_rgba(0,0,0,0.45),-3px_-3px_10px_rgba(255,255,255,0.04)]",
  input:
    "w-full rounded-xl border border-white/[0.05] bg-[#0e1319] px-3 py-2.5 text-sm text-slate-100 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] placeholder:text-slate-500 focus:border-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/15",
  inputReadonly:
    "w-full rounded-xl border border-white/[0.04] bg-[#0e1319]/60 px-3 py-2.5 text-sm text-slate-500 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.03)]",
  btnPrimary:
    "rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(139,92,246,0.15)] hover:from-violet-500 hover:to-indigo-600 active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.5)] disabled:opacity-50",
  btnGhost:
    "rounded-xl border border-white/[0.06] bg-[#121820] px-3 py-2 text-sm text-slate-200 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-white active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)] disabled:opacity-50",
  statViolet:
    "border-violet-500/15 bg-[#14101a] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(139,92,246,0.06)]",
  statEmerald:
    "border-emerald-500/15 bg-[#101a16] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(16,185,129,0.06)]",
  statRose:
    "border-rose-500/15 bg-[#1a1014] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(244,63,94,0.06)]",
  statSky:
    "border-sky-500/15 bg-[#10141a] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(56,189,248,0.06)]",
  statAmber:
    "border-amber-500/15 bg-[#1a1610] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(245,158,11,0.06)]",
  alertWarning:
    "rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-950/50 via-[#121820] to-[#0e1319] shadow-[6px_6px_14px_rgba(0,0,0,0.45)]",
  alertDanger:
    "rounded-2xl border border-rose-500/35 bg-gradient-to-br from-rose-950/40 via-[#121820] to-[#0e1319] shadow-[6px_6px_14px_rgba(0,0,0,0.45)]",
  alertInfo:
    "rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-[#121820] to-[#0e1319] shadow-[6px_6px_14px_rgba(0,0,0,0.45)]",
  chartPanel:
    "flex min-h-[min(20rem,42vh)] w-full flex-col rounded-2xl border border-white/[0.04] bg-[#121820] p-5 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-6",
  kpiStrip:
    "w-full rounded-2xl border border-white/[0.04] bg-[#0e1319] px-4 py-5 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:px-6"
} as const;
