import { lightSurface } from "../workspace/workspace-light";

/** Cres Dynamics Client portal (GemMatrix teal accent). */
export const clientNeu = {
  workspace: "client-neu",
  canvas: lightSurface.canvas,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navIdle: lightSurface.navIdle,
  navActive:
    "border-l-[3px] border-l-brand border-y border-r border-brand/30 bg-brand/10 text-brand font-semibold",
  listRow: lightSurface.listRow
} as const;
