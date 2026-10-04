import { fingerprint } from "@/content/hash";
import { getLangValue, upsertLangValue } from "@/lib/helpers/multi-lang";

type FieldValue =
  string | undefined | { languageCode: string; value: string }[];

const textOf = (value: unknown, language: string): string =>
  typeof value === "string" || Array.isArray(value)
    ? getLangValue(value as FieldValue, language)
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";

/**
 * The input an AI field action receives: one key per source field, read in
 * the language being edited, plus `locale`. The fingerprint identifies those
 * exact source values, so a suggestion made from older text can be flagged.
 */
export const buildAiFieldInput = ({
  language,
  sourceFields,
  values,
}: {
  language: string;
  sourceFields: readonly string[];
  values: Record<string, unknown>;
}): { input: Record<string, string>; sourceFingerprint: string } => {
  const sources = Object.fromEntries(
    sourceFields.map(name => [name, textOf(values[name], language)]),
  );

  return {
    input: { ...sources, locale: language },
    sourceFingerprint: fingerprint(JSON.stringify(sources)),
  };
};

export interface AiFieldSuggestion {
  language: string;
  runId: number;
  sourceFingerprint: string;
  /** The field's value when the suggestion was requested. */
  targetSnapshot: string;
  text: string;
}

/**
 * Whether a suggestion still fits the form: the sources it was made from may
 * have changed, and the editor may have typed into the field meanwhile -
 * in which case accepting must not silently replace their newer words.
 */
export const suggestionFreshness = ({
  currentSourceFingerprint,
  currentTarget,
  suggestion,
}: {
  currentSourceFingerprint: string;
  currentTarget: string;
  suggestion: AiFieldSuggestion;
}): { staleSource: boolean; targetEdited: boolean } => ({
  staleSource: currentSourceFingerprint !== suggestion.sourceFingerprint,
  targetEdited: currentTarget !== suggestion.targetSnapshot,
});

/** The field value after accepting - only the edited language changes. */
export const applyAiSuggestion = ({
  language,
  multiLang,
  text,
  value,
}: {
  language: string;
  multiLang: boolean;
  text: string;
  value: unknown;
}): unknown =>
  multiLang
    ? upsertLangValue(
        Array.isArray(value)
          ? (value as { languageCode: string; value: string }[])
          : undefined,
        language,
        text,
      )
    : text;

export const fieldTextOf = textOf;
