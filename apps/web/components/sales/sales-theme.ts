/** Full-screen sales workspace tokens (amber / brand accent). */
export const salesWs = {
  workspace: "sales-fullscreen",
  canvas: "bg-[#0a0c12]",
  navActive:
    "bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/25",
  navIdle:
    "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
  statRow: "grid grid-cols-2 gap-x-6 gap-y-4 border-b border-white/[0.06] pb-6 sm:grid-cols-4",
  toolRow:
    "flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] py-4 transition-colors hover:bg-white/[0.02]",
  scheduleBanner:
    "mb-6 border-b border-sky-500/20 pb-6"
} as const;
