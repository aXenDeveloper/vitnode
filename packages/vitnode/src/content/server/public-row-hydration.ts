import type { Context } from "hono";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentAdvancedStore } from "./advanced-store";

import { loadPublicPeople } from "../../api/lib/public-people";
import { isContentId } from "../ids";
import { splitContentFieldPath } from "../paths";
import { resolveContentPublicRowFiles } from "./files";

export const isContentPublicPeopleList = (
  definition: AnyContentTypeDefinition,
  name: string,
): boolean => {
  const fieldValue = definition.fields[name];

  return fieldValue?.kind === "user" && fieldValue.multiple;
};

/**
 * The `publicApi.people` half of each row - every to-one name mapped to its
 * public summary or `null`, every to-many name to its summaries in stored
 * order with deleted users left out - without the rest of the row, so it can
 * be merged onto rows another step is still building.
 *
 * One query for the whole page, whatever number of people fields and rows.
 */
const loadContentPublicPeopleOverlay = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  people: readonly string[],
  rows: readonly Record<string, unknown>[],
): Promise<Record<string, unknown>[]> => {
  if (people.length === 0 || rows.length === 0) return rows.map(() => ({}));

  const loaded = await loadPublicPeople(
    c,
    rows.flatMap(row => people.flatMap(name => row[name])),
  );
  const personOf = (id: unknown) =>
    typeof id === "number" ? loaded.get(id) : undefined;

  return rows.map(row =>
    Object.fromEntries(
      people.map(name => {
        const value = row[name];

        if (isContentPublicPeopleList(definition, name)) {
          return [
            name,
            Array.isArray(value) ? value.flatMap(id => personOf(id) ?? []) : [],
          ];
        }

        return [name, personOf(value) ?? null];
      }),
    ),
  );
};

/**
 * Swaps each `publicApi.people` user id for its public summary, or `null`,
 * and each to-many people field's ids for their summaries. The rows must
 * already carry a to-many field's ids, as a revision snapshot does.
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

  const overlay = await loadContentPublicPeopleOverlay(
    c,
    definition,
    people,
    rows,
  );

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
 * exceptions are a `multiple: true` file or people field, which has no column -
 * its identifiers only exist on the row once `loadMany` has put them there - so
 * the files wait for the collections when the allowlist exposes such a file,
 * and the people wait for them when `people` names such a user field.
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
  const peopleLists = people.filter(name =>
    isContentPublicPeopleList(definition, name),
  );
  const collectionFields = [...publicCollections, ...peopleLists];

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
      collectionFields.length === 0 || !advanced
        ? Promise.resolve(undefined)
        : advanced.loadMany(ids, c.get("db"), collectionFields);

    const collectionValuesOf = (
      loaded: Map<ContentId, Record<string, unknown>> | undefined,
      row: Record<string, unknown>,
    ): Record<string, unknown> | undefined =>
      loaded !== undefined && isContentId(definition.idStrategy, row.id)
        ? loaded.get(row.id)
        : undefined;

    const peopleOverlay =
      peopleLists.length === 0
        ? loadContentPublicPeopleOverlay(c, definition, people, nested)
        : collections.then(
            async loaded =>
              await loadContentPublicPeopleOverlay(
                c,
                definition,
                people,
                nested.map(row => ({
                  ...row,
                  ...collectionValuesOf(loaded, row),
                })),
              ),
          );

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
