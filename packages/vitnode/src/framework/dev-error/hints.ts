export interface DevErrorHint {
  description: string;
  snippet?: string;
  title: string;
}

export interface DevErrorWithHints {
  readonly hints: readonly DevErrorHint[];
}

const isHint = (value: unknown): value is DevErrorHint => {
  if (typeof value !== "object" || value === null) return false;

  const { description, snippet, title } = value as Record<string, unknown>;

  return (
    typeof title === "string" &&
    typeof description === "string" &&
    (snippet === undefined || typeof snippet === "string")
  );
};

export const devErrorHintsOf = (error: unknown): DevErrorHint[] => {
  if (typeof error !== "object" || error === null || !("hints" in error)) {
    return [];
  }

  const { hints } = error;

  return Array.isArray(hints) ? hints.filter(isHint) : [];
};
