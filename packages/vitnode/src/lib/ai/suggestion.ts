import { fingerprint } from "@/content/hash";
import { getLangValue, upsertLangValue } from "@/lib/helpers/multi-lang";

type FieldValue =
  string | undefined | { languageCode: string; value: string }[];

export const fieldTextOf = (value: unknown, language: string): string =>
  typeof value === "string" || Array.isArray(value)
    ? getLangValue(value as FieldValue, language)
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";

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
    sourceFields.map(name => [name, fieldTextOf(values[name], language)]),
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
  targetSnapshot: string;
  text: string;
}

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
