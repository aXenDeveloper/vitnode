import type { AnyContentTypeDefinition } from "../types";

import { ContentEngineError } from "../errors";

/**
 * The convenience collection API, built once for both services.
 *
 * Every method here is a **read-modify-write**, and that is the whole reason it
 * is one module rather than two: the read has to happen after the source row is
 * locked, and a helper that read before the lock would lose one of two
 * concurrent additions with nothing to show it had. The service supplies the
 * locking - `run` below - and this file supplies only the arithmetic.
 *
 * `set` is the exception that proves the rule: it replaces the whole collection,
 * so it does not read at all and cannot lose anything.
 */

/**
 * Locks the source record, reads one collection, and applies what `compute`
 * makes of it - all inside one transaction.
 *
 * `compute` runs **after** the row lock, so the state it derives the next
 * collection from is the committed one. It may throw: a reorder that is not a
 * permutation of what is stored is refused there, inside the lock, against the
 * list the write will actually replace.
 */
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

/**
 * A reorder has to be a permutation of what is stored.
 *
 * Refused rather than treated as a `set`, because the two mean different things
 * and only one of them is reversible by looking at the request: a reorder that
 * silently dropped an entry would look like a successful drag. Checked inside
 * the lock, against the list the write is about to replace - checking it against
 * a list read earlier would refuse a valid reorder, or accept an invalid one,
 * whenever somebody else had written in between.
 */
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

/**
 * The five to-many relation operations, for one field.
 *
 * `add` of a target already present, `remove` of one that is not there and
 * `reorder` to the stored order all compute a list equal to what is stored, so
 * the diff finds nothing and the write is a no-op - no `updatedAt`, no version
 * bump, no revision, no event. That falls out of computing the whole next state
 * rather than issuing a targeted `INSERT`, which is why it holds for every one of
 * them without a special case.
 */
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
