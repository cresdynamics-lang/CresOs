/** Dark neumorphism tokens for the Finance workspace (emerald accent). */
export const financeNeu = {
  workspace: "finance-neu",
  canvas: "bg-[#0b0f14]",
  shell:
    "rounded-2xl border border-white/[0.04] bg-[#121820] px-3 py-3 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:px-6 sm:py-4",
  panel:
    "rounded-2xl border border-white/[0.04] bg-[#121820] p-4 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-5",
  panelInset:
    "rounded-xl border border-white/[0.03] bg-[#0e1319] p-3 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-4",
  listRow:
    "rounded-xl border border-white/[0.04] bg-[#10161e] px-3 py-2 shadow-[4px_4px_10px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(255,255,255,0.03)] transition-shadow hover:shadow-[5px_5px_12px_rgba(0,0,0,0.45),-3px_-3px_10px_rgba(255,255,255,0.04)]",
  navActive:
    "bg-[#121820] text-emerald-300 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.04)] border border-emerald-500/20",
  navIdle:
    "border border-transparent text-slate-400 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-3px_-3px_8px_rgba(255,255,255,0.03)] hover:text-slate-200 hover:shadow-[5px_5px_12px_rgba(0,0,0,0.4),-3px_-3px_10px_rgba(255,255,255,0.04)]",
  input:
    "rounded-xl border border-white/[0.05] bg-[#0e1319] px-3 py-2 text-sm text-slate-100 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.03)] placeholder:text-slate-500 focus:border-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/15",
  btnPrimary:
    "rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(16,185,129,0.15)] hover:from-emerald-500 hover:to-teal-600 active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.5)]",
  btnGhost:
    "rounded-xl border border-white/[0.06] bg-[#121820] px-3 py-2 text-sm text-slate-200 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-white active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45)]",
  statEmerald:
    "border-emerald-500/15 bg-[#101a16] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(16,185,129,0.06)]",
  statAmber:
    "border-amber-500/15 bg-[#1a1610] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(245,158,11,0.06)]",
  statRose:
    "border-rose-500/15 bg-[#1a1014] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(244,63,94,0.06)]",
  statViolet:
    "border-violet-500/15 bg-[#14101a] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(139,92,246,0.06)]",
  tableWrap:
    "overflow-x-auto rounded-xl border border-white/[0.04] bg-[#0e1319] shadow-[inset_3px_3px_10px_rgba(0,0,0,0.45),inset_-2px_-2px_8px_rgba(255,255,255,0.02)]",
  alertWarning:
    "rounded-xl border border-amber-500/25 bg-[#1a1610] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(245,158,11,0.06)]",
  alertDanger:
    "rounded-xl border border-rose-500/30 bg-[#1a1014] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(244,63,94,0.08)]",
  alertInfo:
    "rounded-xl border border-emerald-500/20 bg-[#101a16] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(16,185,129,0.05)]",
  kpiStrip:
    "rounded-xl border border-white/[0.04] bg-[#0e1319] p-4 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-5"
} as const;
