/** Dark neumorphism tokens for the Director workspace (sky accent). */
export const directorNeu = {
  workspace: "director-neu",
  canvas: "bg-[#0b0f14]",
  panel:
    "rounded-2xl border border-white/[0.04] bg-[#121820] p-4 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-5",
  panelInset:
    "rounded-xl border border-white/[0.03] bg-[#0e1319] p-3 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-4",
  navIdle:
    "border border-transparent text-slate-400 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-3px_-3px_8px_rgba(255,255,255,0.03)] hover:text-slate-200 hover:shadow-[5px_5px_12px_rgba(0,0,0,0.4),-3px_-3px_10px_rgba(255,255,255,0.04)]",
  navActive:
    "bg-[#121820] text-sky-300 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.04)] border border-sky-500/20",
  btnPrimary:
    "rounded-xl bg-gradient-to-br from-sky-600 to-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(56,189,248,0.15)] hover:from-sky-500 hover:to-cyan-600",
  btnGhost:
    "rounded-xl border border-white/[0.06] bg-[#121820] px-3 py-2 text-sm text-slate-200 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-white disabled:opacity-50",
  statSky:
    "border-sky-500/15 bg-[#10141a] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(56,189,248,0.06)]",
  statEmerald:
    "border-emerald-500/15 bg-[#101a16] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(16,185,129,0.06)]",
  statAmber:
    "border-amber-500/15 bg-[#1a1610] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(245,158,11,0.06)]",
  statRose:
    "border-rose-500/15 bg-[#1a1014] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(244,63,94,0.06)]",
  statViolet:
    "border-violet-500/15 bg-[#14101a] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(139,92,246,0.06)]",
  alertWarning:
    "rounded-xl border border-amber-500/25 bg-[#1a1610] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(245,158,11,0.06)]",
  alertDanger:
    "rounded-xl border border-rose-500/30 bg-[#1a1014] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(244,63,94,0.08)]",
  alertInfo:
    "rounded-xl border border-sky-500/20 bg-[#10141a] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(56,189,248,0.05)]",
  chartPanel:
    "flex min-h-[min(18rem,38vh)] w-full flex-col rounded-2xl border border-white/[0.04] bg-[#121820] p-5 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-6",
  kpiStrip:
    "w-full rounded-xl border border-white/[0.04] bg-[#0e1319] p-4 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-5",
  listRow:
    "rounded-xl border border-white/[0.04] bg-[#10161e] px-3 py-2.5 shadow-[4px_4px_10px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(255,255,255,0.03)]"
} as const;
