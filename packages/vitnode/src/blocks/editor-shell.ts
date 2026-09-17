import type { CSSProperties } from "react";

export type ContentEditorShellMode = "editing" | "preview";

export const EDITOR_SHELL_STYLE = {
  "--editor-sheet-height": "24rem",
  "--editor-sidebar-width": "clamp(20rem, 24vw, 22.5rem)",
} as CSSProperties;

export const EDITOR_SHELL_IDLE_STYLE: CSSProperties = { display: "contents" };

export const EDITOR_SHELL_CLASS =
  "transition-[padding] duration-200 ease-linear";

export const EDITOR_SHELL_EDITING_CLASS =
  "pb-(--editor-sheet-height) md:pe-(--editor-sidebar-width) md:pb-0";
