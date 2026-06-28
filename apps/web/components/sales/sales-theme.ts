/** Full-screen sales workspace tokens (amber / brand accent). */
export const salesWs = {
  workspace: "sales-fullscreen",
  canvas:
    "relative overflow-hidden bg-[#0a0c12] bg-[radial-gradient(ellipse_75%_55%_at_15%_0%,rgba(245,158,11,0.14),transparent),radial-gradient(ellipse_60%_50%_at_90%_10%,rgba(31,111,235,0.1),transparent),radial-gradient(ellipse_55%_45%_at_50%_100%,rgba(16,185,129,0.06),transparent)]",
  navActive:
    "border border-amber-400/30 bg-amber-500/12 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md",
  navIdle:
    "border border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.05] hover:text-slate-200",
  statRow: "grid grid-cols-2 gap-x-6 gap-y-4 border-b border-white/[0.06] pb-6 sm:grid-cols-4",
  toolRow:
    "flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] py-4 transition-colors hover:bg-white/[0.02]",
  scheduleBanner:
    "mb-6 border-b border-sky-500/20 pb-6"
} as const;
