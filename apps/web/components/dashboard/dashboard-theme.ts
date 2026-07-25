import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics command-center dashboard (brand accent). */
export const dashboardNeu = {
  canvas: lightSurface.canvas,
  hero:
    "relative overflow-hidden rounded-3xl border border-[#E5E9EF] bg-white p-5 shadow-sm sm:p-7",
  heroGlow:
    "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl",
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  kpiTile:
    "group relative flex min-h-[6.25rem] flex-col justify-between overflow-hidden rounded-2xl border border-[#E5E9EF] bg-white p-4 shadow-sm transition-all hover:border-brand/40 hover:shadow-md",
  kpiTileActive: "border-brand/40 shadow-md ring-1 ring-brand/20",
  kpiGrid: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
  queueEmpty:
    "flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5",
  queueItem: "rounded-xl border border-[#E5E9EF] bg-white px-4 py-3",
  btnGhost: lightSurface.btnGhost,
  btnPrimary: lightSurface.btnPrimary,
  tasksStrip:
    "flex flex-col gap-3 rounded-xl border border-[#E5E9EF] bg-[#F4F7F9] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between",
  eyebrow: "font-label text-[10px] font-semibold uppercase tracking-[0.24em] text-brand"
} as const;
