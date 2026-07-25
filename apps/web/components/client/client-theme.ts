import { lightSurface } from "../workspace/workspace-light";

/** Bright Cres Dynamics Client portal (teal accent). */
export const clientNeu = {
  workspace: "client-neu",
  canvas: lightSurface.canvas,
  panel: lightSurface.panel,
  panelInset: lightSurface.panelInset,
  navIdle: lightSurface.navIdle,
  navActive:
    "border-l-[3px] border-l-teal-600 border-y border-r border-teal-300 bg-teal-50 text-teal-900 font-semibold",
  listRow: lightSurface.listRow
} as const;
