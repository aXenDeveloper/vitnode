import type { RichTextDocument } from "@vitnode/core/content/rich-text";
import type { MultiLangValue } from "@vitnode/core/lib/helpers/multi-lang";

import { richTextToPlainText } from "@vitnode/core/content/rich-text";
import {
  findLangValue,
  getLangValue,
} from "@vitnode/core/lib/helpers/multi-lang";

export const TRANSLATED_FIELDS = [
  "title",
  "friendlyUrl",
  "content",
  "excerpt",
  "coverImageAlt",
] as const;

export type TranslatedField = (typeof TRANSLATED_FIELDS)[number];

export const REQUIRED_TRANSLATED_FIELDS = [
  "title",
  "friendlyUrl",
  "content",
] as const satisfies readonly TranslatedField[];

export const RECOMMENDED_LENGTH = {
  coverImageAlt: 125,
  excerpt: 160,
  title: 60,
} as const;

/** Every translated field except the article body, which is a document. */
export type ArticleTextField = Exclude<TranslatedField, "content">;

export type ArticleValues = Partial<
  Record<ArticleTextField, MultiLangValue>
> & {
  content?: MultiLangValue<null | RichTextDocument>;
  coverImage?: unknown;
};

/** The article body in one language, if that language has one. */
export const articleContent = (
  values: ArticleValues,
  locale: string,
): null | RichTextDocument => findLangValue(values.content, locale) ?? null;

export const fieldText = (
  values: ArticleValues,
  field: TranslatedField,
  locale: string,
): string =>
  field === "content"
    ? richTextToPlainText(articleContent(values, locale))
    : getLangValue(values[field], locale).trim();

export const hasFieldText = (
  values: ArticleValues,
  field: TranslatedField,
  locale: string,
): boolean => fieldText(values, field, locale) !== "";

export type FieldStatus = "done" | "missing" | "unavailable";

export const translatedFieldStatus = (
  values: ArticleValues,
  field: TranslatedField,
  { source, target }: { source: string; target: string },
): FieldStatus => {
  if (hasFieldText(values, field, target)) return "done";

  return hasFieldText(values, field, source) ? "missing" : "unavailable";
};

const startedLocales = (
  values: ArticleValues,
  locales: readonly string[],
  source: string,
) =>
  locales.filter(
    locale =>
      locale === source ||
      TRANSLATED_FIELDS.some(field => hasFieldText(values, field, locale)),
  );

export type ArticleCheck =
  | { id: "alt"; missing: string[]; ok: boolean }
  | { id: "cover"; ok: boolean }
  | { id: "excerpt"; missing: string[]; ok: boolean }
  | { id: "outdated"; ok: boolean; outdated: string[] }
  | { id: "title"; ok: boolean; tooLong: string[] }
  | { id: "translations"; missing: Record<string, number>; ok: boolean };

export const articleChecks = ({
  locales,
  outdated,
  source,
  values,
}: {
  locales: readonly string[];
  outdated: readonly string[];
  source: string;
  values: ArticleValues;
}): ArticleCheck[] => {
  const started = startedLocales(values, locales, source);
  const tooLong = started.filter(
    locale =>
      fieldText(values, "title", locale).length > RECOMMENDED_LENGTH.title,
  );
  const missingExcerpt = started.filter(
    locale => !hasFieldText(values, "excerpt", locale),
  );
  const hasCover =
    values.coverImage !== null && values.coverImage !== undefined;
  const missingAlt = hasCover
    ? started.filter(locale => !hasFieldText(values, "coverImageAlt", locale))
    : [];
  const missingTranslations = Object.fromEntries(
    locales
      .filter(locale => locale !== source)
      .map(locale => [
        locale,
        REQUIRED_TRANSLATED_FIELDS.filter(
          field =>
            translatedFieldStatus(values, field, { source, target: locale }) ===
            "missing",
        ).length,
      ])
      .filter(([, count]) => count !== 0),
  ) as Record<string, number>;

  return [
    { id: "title", ok: tooLong.length === 0, tooLong },
    { id: "excerpt", missing: missingExcerpt, ok: missingExcerpt.length === 0 },
    { id: "cover", ok: hasCover },
    { id: "alt", missing: missingAlt, ok: missingAlt.length === 0 },
    {
      id: "translations",
      missing: missingTranslations,
      ok: Object.keys(missingTranslations).length === 0,
    },
    { id: "outdated", ok: outdated.length === 0, outdated: [...outdated] },
  ];
};
