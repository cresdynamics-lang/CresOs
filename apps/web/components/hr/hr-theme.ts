/** Dark neumorphism tokens for the HR workspace (rose accent). */
export const hrNeu = {
  workspace: "hr-neu",
  canvas: "bg-[#0b0f14]",
  panel:
    "rounded-2xl border border-white/[0.04] bg-[#121820] p-4 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-5",
  panelInset:
    "rounded-xl border border-white/[0.03] bg-[#0e1319] p-3 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-4",
  navIdle:
    "border border-transparent text-slate-400 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-3px_-3px_8px_rgba(255,255,255,0.03)] hover:text-slate-200 hover:shadow-[5px_5px_12px_rgba(0,0,0,0.4),-3px_-3px_10px_rgba(255,255,255,0.04)]",
  navActive:
    "bg-[#121820] text-rose-300 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.04)] border border-rose-500/20",
  btnPrimary:
    "rounded-xl bg-gradient-to-br from-rose-600 to-pink-700 px-4 py-2 text-sm font-semibold text-white shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(244,63,94,0.15)] hover:from-rose-500 hover:to-pink-600 disabled:opacity-50",
  btnGhost:
    "rounded-xl border border-white/[0.06] bg-[#121820] px-3 py-2 text-sm text-slate-200 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-2px_-2px_8px_rgba(255,255,255,0.03)] hover:text-white disabled:opacity-50",
  statRose:
    "border-rose-500/15 bg-[#1a1014] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(244,63,94,0.06)]",
  statEmerald:
    "border-emerald-500/15 bg-[#101a16] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(16,185,129,0.06)]",
  statViolet:
    "border-violet-500/15 bg-[#14101a] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(139,92,246,0.06)]",
  statAmber:
    "border-amber-500/15 bg-[#1a1610] shadow-[5px_5px_12px_rgba(0,0,0,0.5),-3px_-3px_10px_rgba(245,158,11,0.06)]",
  alertWarning:
    "rounded-xl border border-amber-500/25 bg-[#1a1610] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(245,158,11,0.06)]",
  alertDanger:
    "rounded-xl border border-rose-500/30 bg-[#1a1014] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(244,63,94,0.08)]",
  alertInfo:
    "rounded-xl border border-rose-500/20 bg-[#1a1014] shadow-[4px_4px_12px_rgba(0,0,0,0.45),-2px_-2px_8px_rgba(244,63,94,0.05)]",
  kpiStrip:
    "w-full border-y border-white/[0.06] bg-white/[0.015] py-4",
  /** Fullscreen 2026 layout — flat sections, no card chrome */
  pageHero: "border-b border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent",
  kpiBand: "border-y border-white/[0.06] bg-white/[0.015]",
  kpiCell:
    "border-b border-white/[0.06] px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-8",
  section: "border-b border-white/[0.06] py-6",
  chartZone:
    "flex min-h-[min(20rem,40vh)] flex-col border-b border-white/[0.06] bg-transparent py-6",
  dataBlock: "border-b border-white/[0.06]",
  listRow:
    "border-b border-white/[0.04] px-5 py-4 transition-colors hover:bg-white/[0.02] last:border-b-0 lg:px-8",
  tableWrap: "w-full overflow-x-auto",
  chartPanel:
    "flex min-h-[min(18rem,38vh)] w-full flex-col border-b border-white/[0.06] bg-transparent py-6",
  /** Side panel shell */
  sidePanel:
    "relative z-20 flex h-full max-h-[100dvh] w-[17.5rem] max-w-[92vw] shrink-0 flex-col border-r border-white/[0.04] bg-[#0c1016]/98 shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)]",
  sideHeader:
    "shrink-0 border-b border-white/[0.04] px-4 py-4 shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)]",
  sideGroup:
    "rounded-xl border border-white/[0.03] bg-[#0e1319]/90 p-1.5 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.02)]",
  sideNavIdle:
    "group relative flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-all touch-manipulation shadow-[4px_4px_10px_rgba(0,0,0,0.3),-2px_-2px_8px_rgba(255,255,255,0.02)] hover:border-white/[0.04] hover:bg-[#121820]/60 hover:text-slate-200",
  sideNavActive:
    "group relative flex items-center gap-3 rounded-xl border border-rose-500/25 bg-[#151a22] px-2.5 py-2.5 text-left shadow-[inset_3px_3px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(244,63,94,0.06)]",
  sideIconIdle:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.04] bg-[#121820] text-slate-400 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.4),inset_-1px_-1px_4px_rgba(255,255,255,0.03)] transition-colors group-hover:text-rose-200",
  sideIconActive:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-gradient-to-br from-rose-600/25 to-pink-700/15 text-rose-200 shadow-[0_0_16px_-4px_rgba(244,63,94,0.45)]",
  sideCta:
    "flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-600/20 to-pink-700/10 px-3 py-2.5 text-sm font-semibold text-rose-100 shadow-[4px_4px_12px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(244,63,94,0.08)] transition-all hover:border-rose-400/35 hover:from-rose-600/30 hover:text-white"
} as const;
