/** Watery glass tokens for PM check-in reply UI. */
export const checkInGlass = {
  slideShell:
    "fixed inset-x-0 bottom-0 z-[10060] max-h-[min(88vh,42rem)] overflow-hidden rounded-t-3xl border border-white/10 bg-gradient-to-b from-slate-900/75 via-slate-950/90 to-[#070b10]/95 shadow-[0_-24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
  slideBackdrop: "fixed inset-0 z-[10050] bg-black/45 backdrop-blur-[2px]",
  panel:
    "rounded-2xl border border-white/10 bg-gradient-to-br from-teal-950/25 via-slate-900/40 to-cyan-950/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl",
  field:
    "w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm leading-relaxed text-slate-100 shadow-[inset_0_2px_12px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all placeholder:text-slate-500 focus:border-teal-400/35 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-teal-500/20",
  btnPrimary:
    "rounded-xl bg-gradient-to-br from-teal-500/90 to-cyan-600/90 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(20,184,166,0.25)] transition hover:from-teal-400 hover:to-cyan-500 disabled:opacity-50",
  btnGhost:
    "rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 backdrop-blur-md hover:bg-white/[0.08]"
} as const;
