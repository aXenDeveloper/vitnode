export interface BoardSearch {
  cursor?: string;
}

const CURSOR = /^[A-Za-z0-9_-]{1,512}$/;

export const boardSearch = (input: Record<string, unknown>): BoardSearch =>
  typeof input.cursor === "string" && CURSOR.test(input.cursor)
    ? { cursor: input.cursor }
    : {};

export const BOARDS_HREF = "/boards";

export const boardHref = (slug: string, { cursor }: BoardSearch = {}): string =>
  `/boards/${encodeURIComponent(slug)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
