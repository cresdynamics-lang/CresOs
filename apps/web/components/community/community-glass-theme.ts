/** Liquid glass + clear water droplet tokens for Community. */
export const communityGlass = {
  workspace: "community-glass",
  canvas: "relative h-full min-h-0 overflow-hidden bg-[#040a10]",
  canvasGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_15%_-5%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(ellipse_60%_50%_at_90%_10%,rgba(139,92,246,0.12),transparent_50%),radial-gradient(ellipse_70%_45%_at_50%_110%,rgba(16,185,129,0.1),transparent_55%)]",
  droplets: "community-droplets",
  shell:
    "border border-white/[0.12] bg-white/[0.03] shadow-[0_8px_48px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-3xl",
  sidebarBg: "bg-white/[0.02] backdrop-blur-2xl",
  sidebarHeader:
    "border-b border-white/[0.08] bg-gradient-to-r from-sky-400/[0.06] via-white/[0.03] to-violet-400/[0.06] backdrop-blur-2xl",
  chatHeader: "border-b border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl",
  chatBg: "bg-transparent",
  listHover: "hover:bg-white/[0.05]",
  listActive:
    "bg-gradient-to-r from-sky-400/10 to-violet-400/8 border-l-2 border-l-sky-300/50 backdrop-blur-lg",
  listBorder: "border-white/[0.06]",
  outgoing:
    "bg-gradient-to-br from-emerald-400/25 to-teal-500/20 backdrop-blur-lg border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  incoming:
    "bg-white/[0.06] backdrop-blur-lg border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
  inputBar: "border-t border-white/[0.08] bg-black/15 backdrop-blur-2xl",
  tabActive: "bg-sky-400/12 text-sky-100 border-sky-300/25 backdrop-blur-lg",
  tabIdle: "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 border-transparent",
  sectionHeader: "bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md",
  searchBg:
    "bg-black/15 border border-white/[0.1] backdrop-blur-xl focus-within:border-sky-300/30 focus-within:ring-2 focus-within:ring-sky-400/15",
  iconBtn: "rounded-xl p-2 text-slate-400 hover:bg-white/[0.07] hover:text-slate-100 transition-colors",
  surface: "bg-white/[0.05] backdrop-blur-xl border border-white/[0.1]",
  surfaceDeep: "bg-black/20 backdrop-blur-2xl border border-white/[0.1]",
  composer: "bg-white/[0.07] backdrop-blur-xl border border-white/[0.1] text-slate-100 placeholder-slate-500",
  dayPill:
    "rounded-lg bg-white/[0.06] backdrop-blur-md border border-white/[0.1] px-3 py-1 text-xs text-slate-300 shadow-sm",
  avatar:
    "bg-gradient-to-br from-sky-400/25 to-violet-500/20 backdrop-blur-sm border border-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
  modal: "rounded-2xl border border-white/[0.12] bg-white/[0.05] backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.45)]",
  menuItem: "hover:bg-white/[0.07] text-slate-100"
} as const;
