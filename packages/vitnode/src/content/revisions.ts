import type { CONTENT_ACTOR_TYPES, CONTENT_REVISION_OPERATIONS } from "./const";

export type ContentRevisionOperation =
  (typeof CONTENT_REVISION_OPERATIONS)[number];

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
export type ContentSnapshotValue = boolean | null | number | string;

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

/** One revision as the history list shows it - metadata, never the snapshot. */
export interface ContentRevisionMeta {
  /** Display name of the actor, or `null` for a system mutation. */
  actorName: null | string;
  actorType: ContentActorType;
  actorUserId: null | number;
  changedFields: string[];
  createdAt: Date | string;
  id: number;
  operation: ContentRevisionOperation;
  restoredFromRevisionId: null | number;
  version: number;
}

/** One revision with its snapshot, loaded on demand. */
export interface ContentRevisionDetail extends ContentRevisionMeta {
  snapshot: ContentRevisionSnapshot;
}

export interface ContentRevisionDiffEntry {
  after: ContentSnapshotValue | undefined;
  before: ContentSnapshotValue | undefined;
  name: string;
}

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

    if (before !== null && previous === next) continue;

    entries.push({ after: next, before: previous, name });
  }

  return entries;
};
