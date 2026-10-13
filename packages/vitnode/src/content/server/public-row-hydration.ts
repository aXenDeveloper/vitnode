import type { Context } from "hono";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentAdvancedStore } from "./advanced-store";

import { loadPublicPeople } from "../../api/lib/public-people";
import { isContentId } from "../ids";
import { splitContentFieldPath } from "../paths";
import { resolveContentPublicRowFiles } from "./files";

/**
 * Swaps each `publicApi.people` user id for its public summary, or `null`.
 *
 * One query for the whole page, whatever number of people fields and rows.
 */
export const resolveContentPublicRowPeople = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  rows: readonly Record<string, unknown>[],
): Promise<Record<string, unknown>[]> => {
  const { people } = definition.publicApi;
  if (people.length === 0 || rows.length === 0) return [...rows];

  const loaded = await loadPublicPeople(
    c,
    rows.flatMap(row => people.map(name => row[name])),
  );

  return rows.map(row => ({
    ...row,
    ...Object.fromEntries(
      people.map(name => {
        const id = row[name];

        return [name, typeof id === "number" ? (loaded.get(id) ?? null) : null];
      }),
    ),
  }));
};

/**
 * Puts a group's leaves back under their owner.
 *
 * A group leaf is a column, registered under its canonical `"seo.title"` path,
 * so a public statement hands it back flat and this is what re-nests it.
 */
export const nestContentPublicRow = (
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const nested: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const path = splitContentFieldPath(key);
    if (!path) {
      nested[key] = value;
      continue;
    }

    const [owner, leaf] = path;
    const container = (nested[owner] as Record<string, unknown>) ?? {};
    container[leaf] = value;
    nested[owner] = container;
  }

  return nested;
};

/**
 * Turns the rows one public statement returned into the rows a projector reads.
 *
 * Four steps, in this order and for a reason:
 *
 * 1. nest the group leaves back under their owner, since they arrive as
 *    `"seo.title"` columns;
 * 2. batch-load the collections - and only the ones the allowlist actually
 *    exposes, because querying a private junction table to discard its rows
 *    afterwards is work with no answer attached;
 * 3. attach them to their rows;
 * 4. batch-resolve the file fields, because a `multiple: true` file field
 *    has no column: its identifiers only exist on the row once `loadMany` has
 *    put them there - and then the `publicApi.people` summaries.
 *
 * One batch per page either way. Shared by the localized public service and the
 * plain one, whose statements and localization strategies are deliberately
 * different but whose hydration is the same work.
 */
export const createContentPublicRowHydrator =
  ({
    advanced,
    c,
    definition,
    publicCollections,
  }: {
    /** The collection store, or nothing for a content type that declares none. */
    advanced?: ContentAdvancedStore;
    c: Context;
    definition: AnyContentTypeDefinition;
    /** The collection fields the public allowlist exposes. Nothing else loads. */
    publicCollections: readonly string[];
  }) =>
  async (
    rows: readonly Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> => {
    const nested = rows.map(nestContentPublicRow);
    if (nested.length === 0) return nested;

    const ids = nested
      .map(row => row.id)
      .filter((id): id is ContentId => isContentId(definition.idStrategy, id));
    const loaded =
      publicCollections.length === 0
        ? undefined
        : await advanced?.loadMany(ids, c.get("db"), [...publicCollections]);

    const withCollectionValues =
      loaded === undefined
        ? nested
        : nested.map(row => ({
            ...row,
            ...(isContentId(definition.idStrategy, row.id)
              ? loaded.get(row.id)
              : undefined),
          }));

    // The identifier is replaced by the descriptor here rather than in the
    // projector, so the projector stays the one place that decides *what* is
    // public and this stays the one place that decides what it looks like.
    return await resolveContentPublicRowPeople(
      c,
      definition,
      await resolveContentPublicRowFiles(c, definition, withCollectionValues),
    );
  };
