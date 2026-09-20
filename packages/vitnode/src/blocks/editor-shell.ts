import type { CSSProperties } from "react";

export type ContentEditorShellMode = "editing" | "preview";

export const EDITOR_SHELL_STYLE = {
  "--editor-sheet-height": "24rem",
  "--editor-sidebar-width": "clamp(20rem, 24vw, 22.5rem)",
} as CSSProperties;

export const EDITOR_SHELL_CLASS =
  "transition-[padding] duration-200 ease-linear";

export const EDITOR_SHELL_EDITING_CLASS =
  "pb-(--editor-sheet-height) md:pe-(--editor-sidebar-width) md:pb-0";

/**
 * How long the site takes to give the sidebar its room, and the sidebar takes to
 * slide into it. One number, because the two move together or neither reads as
 * one gesture: `EDITOR_SHELL_CLASS` spends it on padding, the sidebar on a
 * transform, and the editor stays mounted for exactly this long after edit mode
 * ends so the way out is animated as well as the way in.
 */
export const EDITOR_SHELL_TRANSITION_MS = 200;
