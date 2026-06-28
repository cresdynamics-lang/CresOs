/** Liquid glass + water droplet tokens for auth (login / register). */
export const authGlass = {
  workspace: "auth-glass",
  canvas: "relative min-h-screen overflow-hidden bg-[#05080d] text-slate-100",
  canvasGlow:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_15%_0%,rgba(56,189,248,0.2),transparent),radial-gradient(ellipse_60%_50%_at_90%_10%,rgba(212,168,83,0.14),transparent),radial-gradient(ellipse_55%_45%_at_50%_100%,rgba(16,185,129,0.1),transparent)]",
  header:
    "border-b border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl",
  card:
    "rounded-2xl border border-white/12 bg-white/[0.06] p-6 shadow-[0_8px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl sm:p-8",
  cardShine:
    "pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent",
  input:
    "w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)] outline-none backdrop-blur-md transition-all focus:border-sky-400/40 focus:bg-black/30 focus:ring-2 focus:ring-sky-500/15",
  button:
    "mt-1 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br from-sky-500/35 via-emerald-500/30 to-teal-600/35 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(56,189,248,0.2),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-md transition-all hover:from-sky-400/45 hover:via-emerald-400/40 hover:to-teal-500/45 hover:shadow-[0_12px_40px_rgba(56,189,248,0.28)] disabled:pointer-events-none disabled:opacity-55",
  link: "text-sky-300/90 underline-offset-2 transition-colors hover:text-sky-200 hover:underline",
  muted: "text-slate-500",
  label: "mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
} as const;
