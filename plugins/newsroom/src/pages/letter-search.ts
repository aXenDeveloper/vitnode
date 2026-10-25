export interface LetterSearch {
  created?: true;
}

export const letterSearch = (input: Record<string, unknown>): LetterSearch =>
  input.created === true || input.created === "true" ? { created: true } : {};

export const letterHref = (
  slug: string,
  { created }: LetterSearch = {},
): string =>
  `/letters/${encodeURIComponent(slug)}${created ? "?created=true" : ""}`;

export const letterEditHref = (id: number | string): string =>
  `/letters/${encodeURIComponent(String(id))}/edit`;

const positiveId = (raw: unknown): number | undefined => {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^[1-9]\d{0,15}$/.test(raw)
        ? Number(raw)
        : Number.NaN;

  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

export interface LetterNewSearch {
  desk?: number;
}

export const letterNewSearch = (
  input: Record<string, unknown>,
): LetterNewSearch => {
  const desk = positiveId(input.desk);

  return desk === undefined ? {} : { desk };
};

export const letterNewHref = (desk?: number): string =>
  desk === undefined ? "/letters/new" : `/letters/new?desk=${desk}`;
