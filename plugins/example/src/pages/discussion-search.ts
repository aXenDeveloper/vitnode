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
