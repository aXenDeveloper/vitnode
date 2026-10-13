export interface DiscussionSearch {
  created?: true;
}

export const discussionSearch = (
  input: Record<string, unknown>,
): DiscussionSearch =>
  input.created === true || input.created === "true" ? { created: true } : {};

export const discussionHref = (
  slug: string,
  { created }: DiscussionSearch = {},
): string =>
  `/discussions/${encodeURIComponent(slug)}${created ? "?created=true" : ""}`;

export const discussionEditHref = (id: number | string): string =>
  `/discussions/${encodeURIComponent(String(id))}/edit`;

const positiveId = (raw: unknown): number | undefined => {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^[1-9]\d{0,15}$/.test(raw)
        ? Number(raw)
        : Number.NaN;

  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

export interface DiscussionNewSearch {
  /** The board the "New discussion" link came from, preselected in the form. */
  board?: number;
}

export const discussionNewSearch = (
  input: Record<string, unknown>,
): DiscussionNewSearch => {
  const board = positiveId(input.board);

  return board === undefined ? {} : { board };
};

export const discussionNewHref = (board?: number): string =>
  board === undefined ? "/discussions/new" : `/discussions/new?board=${board}`;
