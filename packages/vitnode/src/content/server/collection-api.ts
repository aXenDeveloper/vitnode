import type { AnyContentTypeDefinition } from "../types";

import { ContentEngineError } from "../errors";

export type ContentCollectionRunner<TResult, TOptions> = (
  itemId: number,
  field: string,
  compute: (current: unknown[]) => unknown[],
  options: TOptions | undefined,
) => Promise<null | TResult>;

/** Reads one collection without locking. Used only by `get` and `list`. */
export type ContentCollectionReader = (
  itemId: number,
  field: string,
  options: unknown,
) => Promise<unknown[]>;

/** Replaces a whole collection. `set` needs no lock-then-read. */
export type ContentCollectionWriter<TResult, TOptions> = (
  itemId: number,
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
  current: readonly number[];
  field: string;
  next: readonly number[];
  noun: string;
}): void => {
  const before = [...current].sort((a, b) => a - b);
  const after = [...new Set(next)].sort((a, b) => a - b);

  const same =
    before.length === after.length &&
    before.every((id, index) => id === after[index]);
  if (same && next.length === new Set(next).size) return;

  throw new ContentEngineError(
    `Reorder of "${field}" must list exactly the ${noun} ids it already has, once each. Use \`set\` to add or remove.`,
    { contentTypeId },
  );
};

const asNumbers = (current: readonly unknown[]): number[] =>
  current.map(value => Number(value)).filter(value => Number.isInteger(value));

const asRows = (current: readonly unknown[]): Record<string, unknown>[] =>
  current.filter(
    (value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null,
  );

export const buildContentRelationOperations = <TResult, TOptions>({
  api,
  contentTypeId,
  field,
}: {
  api: ContentCollectionApi<TResult, TOptions>;
  contentTypeId: string;
  field: string;
}) => ({
  add: async (
    itemId: number,
    relatedItemId: number,
    options?: TOptions,
  ): Promise<null | TResult> =>
    await api.run(
      itemId,
      field,
      current => {
        const ids = asNumbers(current);

        return ids.includes(relatedItemId) ? ids : [...ids, relatedItemId];
      },
      options,
    ),

  get: async (itemId: number, options?: unknown): Promise<number[]> =>
    asNumbers(await api.read(itemId, field, options)),

  remove: async (
    itemId: number,
    relatedItemId: number,
    options?: TOptions,
  ): Promise<null | TResult> =>
    await api.run(
      itemId,
      field,
      current => asNumbers(current).filter(id => id !== relatedItemId),
      options,
    ),

  reorder: async (
    itemId: number,
    relatedItemIds: readonly number[],
    options?: TOptions,
  ): Promise<null | TResult> =>
    await api.run(
      itemId,
      field,
      current => {
        assertContentPermutation({
          contentTypeId,
          current: asNumbers(current),
          field,
          next: relatedItemIds,
          noun: "target",
        });

        return [...relatedItemIds];
      },
      options,
    ),

  set: async (
    itemId: number,
    relatedItemIds: readonly number[],
    options?: TOptions,
  ): Promise<null | TResult> =>
    await api.write(itemId, field, relatedItemIds, options),
});

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
    itemId: number,
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
    itemId: number,
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
    itemId: number,
    options?: unknown,
  ): Promise<Record<string, unknown>[]> =>
    asRows(await api.read(itemId, field, options)),

  reorder: async (
    itemId: number,
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
          current: rows.map(row => Number(row.id)),
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
    itemId: number,
    rows: readonly Record<string, unknown>[],
    options?: TOptions,
  ): Promise<null | TResult> => await api.write(itemId, field, rows, options),

  update: async (
    itemId: number,
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
