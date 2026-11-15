const isFilled = (value: unknown): boolean =>
  value !== null &&
  value !== undefined &&
  !(typeof value === "string" && value.trim() === "");

export const resolveContentLocalizedValues = ({
  defaultLocale,
  fields,
  locale,
  translations,
}: {
  defaultLocale: string;
  fields: readonly string[];
  locale: null | string;
  translations: readonly {
    locale: string;
    values: Record<string, unknown>;
  }[];
}): Record<string, unknown> => {
  const requested = locale?.toLowerCase() ?? null;
  const fallback = defaultLocale.toLowerCase();
  const rank = (candidate: string): number => {
    const code = candidate.toLowerCase();
    if (code === requested) return 0;

    return code === fallback ? 1 : 2;
  };
  const ordered = translations.toSorted(
    (a, b) => rank(a.locale) - rank(b.locale),
  );

  return Object.fromEntries(
    fields.map(field => [
      field,
      ordered.map(translation => translation.values[field]).find(isFilled) ??
        null,
    ]),
  );
};
