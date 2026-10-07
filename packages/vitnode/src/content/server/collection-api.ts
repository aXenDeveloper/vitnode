import type { ContentId, ContentIdStrategy } from "../ids";
import type { AnyContentTypeDefinition } from "../types";

import { ContentEngineError } from "../errors";
import { contentIdKey, contentIdsOf, parseContentId } from "../ids";

export type ContentCollectionRunner<TResult, TOptions> = (
  itemId: ContentId,
  field: string,
  compute: (current: unknown[]) => unknown[],
  options: TOptions | undefined,
) => Promise<null | TResult>;

/** Reads one collection without locking. Used only by `get` and `list`. */
export type ContentCollectionReader = (
  itemId: ContentId,
  field: string,
  options: unknown,
) => Promise<unknown[]>;

/** Replaces a whole collection. `set` needs no lock-then-read. */
export type ContentCollectionWriter<TResult, TOptions> = (
  itemId: ContentId,
  field: string,
  next: readonly unknown[],
  options: TOptions | undefined,
) => Promise<null | TResult>;

export interface ContentCollectionApi<TResult, TOptions> {
  read: ContentCollectionReader;
  run: ContentCollectionRunner<TResult, TOptions>;
  write: ContentCollectionWriter<TResult, TOptions>;
}

export const assertContentPermutation = ({
  contentTypeId,
  current,
  field,
  next,
  noun,
}: {
  contentTypeId: string;
  current: readonly ContentId[];
  field: string;
  next: readonly ContentId[];
  noun: string;
}): void => {
  // Compared by storage key, so a `bigint` target is never rounded and a
  // number and its own digits are the same identifier.
  const before = current.map(contentIdKey).sort();
  const nextKeys = next.map(contentIdKey);
  const after = [...new Set(nextKeys)].sort();

  const same =
    before.length === after.length &&
    before.every((id, index) => id === after[index]);
  if (same && nextKeys.length === new Set(nextKeys).size) return;

  throw new ContentEngineError(
    `Reorder of "${field}" must list exactly the ${noun} ids it already has, once each. Use \`set\` to add or remove.`,
    { contentTypeId },
  );
};

/** A repeatable child's own id - always `serial`, whatever the owner's strategy. */
const asChildIds = (current: readonly unknown[]): number[] =>
  current.map(value => Number(value)).filter(value => Number.isInteger(value));

/**
 * A caller's identifier in the target's canonical representation, so `"7"` and
 * `7` - or a bigint and its digits - name the same entry. Refused outright when
 * it cannot name a record of the target at all.
 */
const asTargetId = (
  strategy: ContentIdStrategy,
  value: ContentId,
  contentTypeId: string,
  field: string,
): ContentId => {
  const parsed = parseContentId(strategy, value);
  if (parsed === null) {
    throw new ContentEngineError(
      `${JSON.stringify(value)} is not a valid identifier for "${field}".`,
      { contentTypeId },
    );
  }

  return parsed;
};

const sameId = (left: ContentId, right: ContentId): boolean =>
  contentIdKey(left) === contentIdKey(right);

const asRows = (current: readonly unknown[]): Record<string, unknown>[] =>
  current.filter(
    (value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null,
  );

export const buildContentRelationOperations = <TResult, TOptions>({
  api,
  contentTypeId,
  field,
  strategy = "serial",
}: {
  api: ContentCollectionApi<TResult, TOptions>;
  contentTypeId: string;
  field: string;
  /** The target's id strategy: a relation's target's, `serial` for users and files. */
  strategy?: ContentIdStrategy;
}) => {
  const asIds = (current: readonly unknown[]): ContentId[] =>
    contentIdsOf(strategy, current);
  const target = (value: ContentId): ContentId =>
    asTargetId(strategy, value, contentTypeId, field);

  return {
    add: async (
      itemId: ContentId,
      relatedItemId: ContentId,
      options?: TOptions,
    ): Promise<null | TResult> => {
      const related = target(relatedItemId);

      return await api.run(
        itemId,
        field,
        current => {
          const ids = asIds(current);

          return ids.some(id => sameId(id, related)) ? ids : [...ids, related];
        },
        options,
      );
    },

    get: async (itemId: ContentId, options?: unknown): Promise<ContentId[]> =>
      asIds(await api.read(itemId, field, options)),

    remove: async (
      itemId: ContentId,
      relatedItemId: ContentId,
      options?: TOptions,
    ): Promise<null | TResult> => {
      const related = target(relatedItemId);

      return await api.run(
        itemId,
        field,
        current => asIds(current).filter(id => !sameId(id, related)),
        options,
      );
    },

    reorder: async (
      itemId: ContentId,
      relatedItemIds: readonly ContentId[],
      options?: TOptions,
    ): Promise<null | TResult> => {
      const next = relatedItemIds.map(target);

      return await api.run(
        itemId,
        field,
        current => {
          assertContentPermutation({
            contentTypeId,
            current: asIds(current),
            field,
            next,
            noun: "target",
          });

          return next;
        },
        options,
      );
    },

    set: async (
      itemId: ContentId,
      relatedItemIds: readonly ContentId[],
      options?: TOptions,
    ): Promise<null | TResult> =>
      await api.write(itemId, field, relatedItemIds, options),
  };
};

/** The six repeatable operations, for one field. Same locking, same no-op rule. */
export const buildContentRepeatableOperations = <TResult, TOptions>({
  api,
  contentTypeId,
  field,
}: {
  api: ContentCollectionApi<TResult, TOptions>;
  contentTypeId: string;
  field: string;
}) => ({
  create: async (
    itemId: ContentId,
    values: Record<string, unknown>,
    options?: TOptions,
  ): Promise<null | TResult> =>
    await api.run(
      itemId,
      field,
      current => [...asRows(current), values],
      options,
    ),

  delete: async (
    itemId: ContentId,
    childId: number,
    options?: TOptions,
  ): Promise<null | TResult> =>
    await api.run(
      itemId,
      field,
      current => asRows(current).filter(row => row.id !== childId),
      options,
    ),

  list: async (
    itemId: ContentId,
    options?: unknown,
  ): Promise<Record<string, unknown>[]> =>
    asRows(await api.read(itemId, field, options)),

  reorder: async (
    itemId: ContentId,
    childIds: readonly number[],
    options?: TOptions,
  ): Promise<null | TResult> =>
    await api.run(
      itemId,
      field,
      current => {
        const rows = asRows(current);
        assertContentPermutation({
          contentTypeId,
          current: asChildIds(rows.map(row => row.id)),
          field,
          next: childIds,
          noun: "entry",
        });

        const byId = new Map(rows.map(row => [Number(row.id), row]));

        return childIds.map(childId => byId.get(childId) ?? {});
      },
      options,
    ),

  set: async (
    itemId: ContentId,
    rows: readonly Record<string, unknown>[],
    options?: TOptions,
  ): Promise<null | TResult> => await api.write(itemId, field, rows, options),

  update: async (
    itemId: ContentId,
    childId: number,
    values: Record<string, unknown>,
    options?: TOptions,
  ): Promise<null | TResult> =>
    await api.run(
      itemId,
      field,
      current =>
        asRows(current).map(row =>
          Number(row.id) === childId ? { ...row, ...values, id: childId } : row,
        ),
      options,
    ),
});

/** Which of the two shapes a collection field is, by name. */
export const contentCollectionKinds = (
  definition: AnyContentTypeDefinition,
  fields: readonly string[],
): { relations: string[]; repeatables: string[] } => {
  const relations: string[] = [];
  const repeatables: string[] = [];

  for (const field of fields) {
    if (definition.fields[field]?.kind === "repeatable") {
      repeatables.push(field);
      continue;
    }
    relations.push(field);
  }

  return { relations, repeatables };
};
