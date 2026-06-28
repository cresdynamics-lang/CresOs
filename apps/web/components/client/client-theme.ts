/** Dark neumorphism tokens for the Client portal (teal accent). */
export const clientNeu = {
  workspace: "client-neu",
  canvas: "bg-[#0a0d14]",
  panel:
    "rounded-2xl border border-white/[0.05] bg-[#0f1419] p-4 shadow-[6px_6px_14px_rgba(0,0,0,0.55),-4px_-4px_12px_rgba(255,255,255,0.04)] sm:p-5",
  panelInset:
    "rounded-xl border border-white/[0.04] bg-[#0c1016] p-3 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.5),inset_-3px_-3px_8px_rgba(255,255,255,0.03)] sm:p-4",
  navIdle:
    "border border-transparent text-slate-400 shadow-[4px_4px_10px_rgba(0,0,0,0.35),-3px_-3px_8px_rgba(255,255,255,0.03)] hover:text-slate-200",
  navActive:
    "bg-[#101820] text-teal-300 shadow-[inset_3px_3px_8px_rgba(0,0,0,0.45),inset_-2px_-2px_6px_rgba(255,255,255,0.04)] border border-teal-500/25",
  listRow:
    "rounded-xl border border-white/[0.04] bg-[#101820] px-3 py-2.5 shadow-[4px_4px_10px_rgba(0,0,0,0.4),-2px_-2px_8px_rgba(255,255,255,0.03)]"
} as const;
