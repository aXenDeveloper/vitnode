import type { Context } from "hono";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentAdvancedStore } from "./advanced-store";

import { loadPublicPeople } from "../../api/lib/public-people";
import { isContentId } from "../ids";
import { splitContentFieldPath } from "../paths";
import { resolveContentPublicRowFiles } from "./files";

/**
 * The `publicApi.people` half of each row - every name mapped to its public
 * summary, or `null` - without the rest of the row, so it can be merged onto
 * rows another step is still building.
 *
 * One query for the whole page, whatever number of people fields and rows.
 */
const loadContentPublicPeopleOverlay = async (
  c: Context,
  people: readonly string[],
  rows: readonly Record<string, unknown>[],
): Promise<Record<string, unknown>[]> => {
  if (people.length === 0 || rows.length === 0) return rows.map(() => ({}));

  const loaded = await loadPublicPeople(
    c,
    rows.flatMap(row => people.map(name => row[name])),
  );

  return rows.map(row =>
    Object.fromEntries(
      people.map(name => {
        const id = row[name];

        return [name, typeof id === "number" ? (loaded.get(id) ?? null) : null];
      }),
    ),
  );
};

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

  const overlay = await loadContentPublicPeopleOverlay(c, people, rows);

  return rows.map((row, index) => ({ ...row, ...overlay[index] }));
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
 * 1. nest the group leaves back under their owner, since they arrive as
 *    `"seo.title"` columns;
 * 2. batch-load the collections - and only the ones the allowlist actually
 *    exposes, because querying a private junction table to discard its rows
 *    afterwards is work with no answer attached;
 * 3. batch-resolve the file fields and the `publicApi.people` summaries.
 *
 * Steps 2 and 3 run side by side: none of them reads what another writes. The
 * one exception is a `multiple: true` file field, which has no column - its
 * identifiers only exist on the row once `loadMany` has put them there - so
 * when the allowlist exposes one, the files wait for the collections (the
 * people still do not).
 *
 * One batch per page either way. Shared by the localized public service and the
 * plain one, whose statements and localization strategies are deliberately
 * different but whose hydration is the same work.
 */
export const createContentPublicRowHydrator = ({
  advanced,
  c,
  definition,
  people = definition.publicApi.people,
  publicCollections,
}: {
  /** The collection store, or nothing for a content type that declares none. */
  advanced?: ContentAdvancedStore;
  c: Context;
  definition: AnyContentTypeDefinition;
  /** The people fields to hydrate. Defaults to every `publicApi.people`. */
  people?: readonly string[];
  /** The collection fields the public allowlist exposes. Nothing else loads. */
  publicCollections: readonly string[];
}) => {
  const filesNeedCollections = publicCollections.some(
    name => definition.fields[name]?.kind === "file",
  );

  return async (
    rows: readonly Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> => {
    const nested = rows.map(nestContentPublicRow);
    if (nested.length === 0) return nested;

    const ids = nested
      .map(row => row.id)
      .filter((id): id is ContentId => isContentId(definition.idStrategy, id));
    const collections: Promise<
      Map<ContentId, Record<string, unknown>> | undefined
    > =
      publicCollections.length === 0 || !advanced
        ? Promise.resolve(undefined)
        : advanced.loadMany(ids, c.get("db"), [...publicCollections]);
    const peopleOverlay = loadContentPublicPeopleOverlay(c, people, nested);

    const collectionValuesOf = (
      loaded: Map<ContentId, Record<string, unknown>> | undefined,
      row: Record<string, unknown>,
    ): Record<string, unknown> | undefined =>
      loaded !== undefined && isContentId(definition.idStrategy, row.id)
        ? loaded.get(row.id)
        : undefined;

    // The identifier is replaced by the descriptor here rather than in the
    // projector, so the projector stays the one place that decides *what* is
    // public and this stays the one place that decides what it looks like.
    if (filesNeedCollections) {
      const [withFiles, overlay] = await Promise.all([
        collections.then(
          async loaded =>
            await resolveContentPublicRowFiles(
              c,
              definition,
              nested.map(row => ({
                ...row,
                ...collectionValuesOf(loaded, row),
              })),
            ),
        ),
        peopleOverlay,
      ]);

      return withFiles.map((row, index) => ({ ...row, ...overlay[index] }));
    }

    // No public collection is a file field here, so the collection values and
    // the file descriptors land on disjoint keys and merge in any order.
    const [loaded, withFiles, overlay] = await Promise.all([
      collections,
      resolveContentPublicRowFiles(c, definition, nested),
      peopleOverlay,
    ]);

    return withFiles.map((row, index) => ({
      ...row,
      ...collectionValuesOf(loaded, row),
      ...overlay[index],
    }));
  };
};
