/** Liquid glass + water droplet tokens for Community. */
export const communityGlass = {
  workspace: "community-glass",
  canvas: "relative h-full min-h-0 overflow-hidden bg-[#061018]",
  canvasGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,rgba(56,189,248,0.18),transparent),radial-gradient(ellipse_55%_45%_at_85%_15%,rgba(139,92,246,0.14),transparent),radial-gradient(ellipse_50%_40%_at_50%_100%,rgba(16,185,129,0.08),transparent)]",
  droplets: "community-droplets",
  shell:
    "border border-white/10 bg-white/[0.05] shadow-[0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl",
  sidebarBg: "bg-white/[0.04] backdrop-blur-xl",
  sidebarHeader: "border-b border-white/10 bg-gradient-to-r from-sky-500/[0.08] via-white/[0.04] to-violet-500/[0.08] backdrop-blur-xl",
  chatHeader: "border-b border-white/10 bg-white/[0.06] backdrop-blur-xl",
  chatBg: "bg-transparent",
  listHover: "hover:bg-white/[0.06]",
  listActive:
    "bg-gradient-to-r from-sky-500/15 to-violet-500/10 border-l-2 border-l-sky-400/60 backdrop-blur-md",
  outgoing: "bg-gradient-to-br from-emerald-500/35 to-teal-600/30 backdrop-blur-md border border-white/10",
  incoming: "bg-white/[0.08] backdrop-blur-md border border-white/[0.08]",
  inputBar: "border-t border-white/10 bg-black/25 backdrop-blur-xl",
  tabActive: "bg-sky-500/15 text-sky-200 border-sky-400/30 backdrop-blur-md",
  tabIdle: "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 border-transparent",
  sectionHeader: "bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-sm",
  searchBg:
    "bg-black/20 border border-white/10 backdrop-blur-md focus-within:border-sky-400/35 focus-within:ring-2 focus-within:ring-sky-500/15"
} as const;
