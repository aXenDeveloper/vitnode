export interface DeskSearch {
  cursor?: string;
}

const CURSOR = /^[A-Za-z0-9_-]{1,512}$/;

export const deskSearch = (input: Record<string, unknown>): DeskSearch =>
  typeof input.cursor === "string" && CURSOR.test(input.cursor)
    ? { cursor: input.cursor }
    : {};

export const DESKS_HREF = "/desks";

export const deskHref = (slug: string, { cursor }: DeskSearch = {}): string =>
  `/desks/${encodeURIComponent(slug)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
