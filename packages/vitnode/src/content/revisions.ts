import type {
  CONTENT_ACTOR_TYPES,
  CONTENT_REVISION_OPERATIONS,
  CONTENT_TRANSLATION_REVISION_OPERATIONS,
} from "./const";

export type ContentRevisionOperation =
  (typeof CONTENT_REVISION_OPERATIONS)[number];

export type ContentTranslationRevisionOperation =
  (typeof CONTENT_TRANSLATION_REVISION_OPERATIONS)[number];

export type ContentActorType = (typeof CONTENT_ACTOR_TYPES)[number];

/**
 * Who performed a mutation.
 *
 * A plain value object, not something read off a request: the editorial service
 * takes one as an argument, so a route builds it from the Hono context and a
 * queue handler hands over `{ type: "system", userId: null }` without either of
 * them depending on the other's world.
 */
export interface ContentActor {
  type: ContentActorType;
  userId: null | number;
}

/**
 * A value as it is stored in a snapshot.
 *
 * Deliberately narrow: a `Date` becomes an ISO string, a relation or user
 * becomes the foreign key it already is, and nothing else survives. There is no
 * runtime class instance in a snapshot, so re-reading one years later needs
 * nothing but `JSON.parse`.
 */
export type ContentSnapshotScalar = boolean | null | number | string;

/**
 * A value as it is stored in a snapshot.
 *
 * Still plain JSON - re-reading a snapshot years later needs nothing but
 * `JSON.parse` - but Stage 6 gives it three shapes rather than one:
 *
 * - a **scalar**, as before;
 * - a **group**, as the nested object the field actually is (`{ title, description }`),
 *   or `null`. Never the flattened `seo_title` columns: a snapshot records the
 *   logical state, and the column names are an internal mapping that a schema
 *   change is allowed to move;
 * - a **collection**, as identity. A to-many relation is `[2, 5, 9]` - the ids,
 *   in stored order - and a repeatable is its child rows, each with its own `id`.
 *   Never the *expanded* related records: those have their own history, their own
 *   permissions and their own publication state, and restoring an article must
 *   not rewrite a category.
 */
export type ContentSnapshotValue =
  | ContentSnapshotScalar
  | number[]
  | Record<string, ContentSnapshotScalar>
  | Record<string, ContentSnapshotScalar>[];

/**
 * The complete post-mutation editable state of one record.
 *
 * Complete rather than a patch: restoring from a patch means replaying every
 * revision since, which turns a single read into a fold that gets slower the
 * longer the history is - and produces nothing if one link was pruned.
 *
 * What is deliberately absent is as important as what is here. No relation
 * *labels* (they are administrative metadata belonging to another content type,
 * which may not publish them at all), no search document, no cache tags,
 * nothing derived.
 */
export interface ContentRevisionSnapshot {
  contentTypeId: string;
  createdAt: string;
  /** Every declared field, by name. */
  fields: Record<string, ContentSnapshotValue>;
  id: number;
  /** Present only for a content type with the publication lifecycle. */
  publication?: { publishedAt: null | string; status: string };
  schemaVersion: number;
  updatedAt: string;
  version: number;
}

/**
 * The complete post-mutation state of **one translation**.
 *
 * The same design as {@link ContentRevisionSnapshot} - complete, plain JSON,
 * nothing derived - restricted to one language. What is absent is the point:
 *
 * - **no shared fields.** They live on the base row and have their own history.
 *   A translation restore that carried them would let somebody with
 *   `can_translate` rewrite the record's shared values through the back door.
 * - **no other locale's values.** Restoring Polish must not touch English.
 * - **no public response object and no search document.** Both are derived, and
 *   both are shaped by configuration that may since have changed.
 *
 * `locale` is carried alongside `languageId` on purpose: the revision row's
 * `languageId` has no foreign key, so this is what keeps a revision readable
 * after the language it names has been deleted.
 */
export interface ContentTranslationRevisionSnapshot {
  contentTypeId: string;
  createdAt: string;
  /** Every *localized* field, by name. */
  fields: Record<string, ContentSnapshotValue>;
  itemId: number;
  languageId: number;
  /** The canonical `core_languages.code` at the time of the mutation. */
  locale: string;
  /** Present only for a content type with the publication lifecycle. */
  publication?: { publishedAt: null | string; status: string };
  schemaVersion: number;
  updatedAt: string;
  /** The version *this translation* holds after the mutation. */
  version: number;
}

/**
 * Either snapshot shape, for the shared `core_content_revisions.snapshot` column.
 *
 * They are told apart by the row's `languageId`, not by inspecting the JSON: the
 * column is what the query filters on, and a discriminator inside the payload
 * would be a second source of truth for the same fact.
 */
export type ContentAnyRevisionSnapshot =
  ContentRevisionSnapshot | ContentTranslationRevisionSnapshot;

/** One revision as the history list shows it - metadata, never the snapshot. */
export interface ContentRevisionMeta {
  /** Display name of the actor, or `null` for a system mutation. */
  actorName: null | string;
  /**
   * The actor's role colour, so their name reads the same here as it does in
   * every other admin list. `null` for a system mutation, a deleted account or
   * a role with no colour of its own.
   */
  actorRoleColor: null | string;
  actorType: ContentActorType;
  actorUserId: null | number;
  changedFields: string[];
  createdAt: Date | string;
  id: number;
  operation: ContentRevisionOperation;
  restoredFromRevisionId: null | number;
  version: number;
}

/**
 * One revision with its snapshot, loaded on demand.
 *
 * Generic over the snapshot shape so the translation history reads
 * `ContentRevisionDetail<ContentTranslationRevisionSnapshot>` and gets the
 * localized shape - without a second model, and without widening the existing
 * default that every Stage 4 caller relies on.
 */
export interface ContentRevisionDetail<
  TSnapshot = ContentRevisionSnapshot,
> extends ContentRevisionMeta {
  snapshot: TSnapshot;
}

export interface ContentRevisionDiffEntry {
  after: ContentSnapshotValue | undefined;
  before: ContentSnapshotValue | undefined;
  name: string;
}

/**
 * Whether two snapshot values are the same.
 *
 * `JSON.stringify` rather than `===`, because a group and a collection are
 * objects: two structurally equal `seo` groups are the same state, and the
 * revision list must not claim otherwise. Key order is deterministic - both
 * sides are built by `contentRevisionSnapshot`, which emits declaration order -
 * so the comparison is exact rather than approximate.
 */
const sameSnapshotValue = (
  before: ContentSnapshotValue | undefined,
  after: ContentSnapshotValue | undefined,
): boolean => {
  if (before === after) return true;
  if (before === undefined || after === undefined) return false;
  if (typeof before !== "object" || typeof after !== "object") return false;

  return JSON.stringify(before) === JSON.stringify(after);
};

/**
 * Field-level difference between two snapshots, in declaration order.
 *
 * Walks `names` - the content type's *current* field list - rather than the
 * union of both snapshots' keys, so a field that has since been removed does
 * not show up as "changed to nothing". The same projection the restore path
 * applies, and for the same reason.
 *
 * `undefined` on either side means "this snapshot never carried the field",
 * which the UI renders differently from an explicit `null`.
 */
export const contentRevisionDiff = (
  names: readonly string[],
  before: ContentRevisionSnapshot | null,
  after: ContentRevisionSnapshot,
): ContentRevisionDiffEntry[] => {
  const entries: ContentRevisionDiffEntry[] = [];

  for (const name of names) {
    const previous = before?.fields[name];
    const next = after.fields[name];

    if (before !== null && sameSnapshotValue(previous, next)) continue;

    entries.push({ after: next, before: previous, name });
  }

  return entries;
};
