/** Liquid glass tokens for developer workspace (violet / sky accent). */
export const devGlass = {
  workspace: "developer-glass",
  canvas: "relative min-h-full overflow-hidden bg-[#080b12]",
  canvasGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_15%_-5%,rgba(139,92,246,0.24),transparent),radial-gradient(ellipse_55%_45%_at_95%_5%,rgba(56,189,248,0.16),transparent),radial-gradient(ellipse_45%_35%_at_50%_110%,rgba(99,102,241,0.1),transparent)]",
  content: "relative z-[1] flex min-h-0 flex-1 flex-col",
  shell:
    "rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl sm:px-6 sm:py-4",
  card:
    "rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.08] via-white/[0.05] to-sky-500/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all duration-300 hover:border-violet-400/25 hover:shadow-[0_12px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.14)]",
  panelInset:
    "rounded-xl border border-white/[0.08] bg-black/20 p-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-4",
  listRow:
    "rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-lg transition-all hover:border-violet-400/20 hover:bg-white/[0.06]",
  divider: "border-white/10",
  chip:
    "rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md",
  chipActive:
    "rounded-lg border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-200 backdrop-blur-md",
  input:
    "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-sm placeholder:text-slate-500 focus:border-violet-400/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20",
  btnPrimary:
    "rounded-xl bg-gradient-to-br from-violet-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:from-violet-500 hover:to-sky-500",
  btnGhost:
    "rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-200 shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md hover:bg-white/[0.08]",
  alertWarning:
    "rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-white/[0.04] to-transparent p-4 shadow-[0_8px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:p-5",
  alertInfo:
    "rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/12 via-white/[0.04] to-sky-500/5 p-4 shadow-[0_8px_28px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:p-5",
  tableWrap:
    "overflow-x-auto rounded-xl border border-white/10 bg-black/20 shadow-[inset_0_2px_12px_rgba(0,0,0,0.3)] backdrop-blur-md",
  navActive:
    "border border-violet-400/30 bg-violet-500/15 text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md",
  navIdle:
    "border border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-200"
} as const;
