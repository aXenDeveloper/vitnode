import type { VisualEditorSaveRefusal } from "./types";

/** The `refusal` message of a thrown {@link VisualEditorSaveRefusal}, if it is one. */
export const saveRefusalOf = (cause: unknown): string | undefined => {
  if (typeof cause !== "object" || cause === null) return undefined;

  const { refusal } = cause as Partial<VisualEditorSaveRefusal>;

  return typeof refusal === "string" && refusal.trim().length > 0
    ? refusal
    : undefined;
};

/** Whether a thrown value is a refusal marked `conflict: true`. */
export const isSaveConflict = (cause: unknown): boolean =>
  saveRefusalOf(cause) !== undefined &&
  (cause as Partial<VisualEditorSaveRefusal>).conflict === true;
