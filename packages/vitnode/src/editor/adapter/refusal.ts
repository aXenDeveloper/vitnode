import type { VisualEditorSaveRefusal } from "./types";

export const saveRefusalOf = (cause: unknown): string | undefined => {
  if (typeof cause !== "object" || cause === null) return undefined;

  const { refusal } = cause as Partial<VisualEditorSaveRefusal>;

  return typeof refusal === "string" && refusal.trim().length > 0
    ? refusal
    : undefined;
};
