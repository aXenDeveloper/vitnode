import type {
  CONTENT_ACTOR_TYPES,
  CONTENT_REVISION_OPERATIONS,
  CONTENT_TRANSLATION_REVISION_OPERATIONS,
} from "./const";
import type { ContentId } from "./ids";

export type ContentRevisionOperation =
  (typeof CONTENT_REVISION_OPERATIONS)[number];

export type ContentTranslationRevisionOperation =
  (typeof CONTENT_TRANSLATION_REVISION_OPERATIONS)[number];

export type ContentActorType = (typeof CONTENT_ACTOR_TYPES)[number];

export interface ContentActor {
  type: ContentActorType;
  userId: null | number;
}

export type ContentSnapshotScalar = boolean | null | number | string;

export type ContentSnapshotValue =
  | ContentId[]
  // A to-many reference: numbers for users, files and serial targets, strings
  // for `uuid` and `bigint` targets.
  | ContentSnapshotScalar
  | Record<string, ContentSnapshotScalar>
  | Record<string, ContentSnapshotScalar>[];

export interface ContentRevisionSnapshot {
  contentTypeId: string;
  createdAt: string;
  /** Every declared field, by name. */
  fields: Record<string, ContentSnapshotValue>;
  /** The record: a number for `serial`, the canonical string otherwise. */
  id: ContentId;
  /** Present only for a content type with the publication lifecycle. */
  publication?: { publishedAt: null | string; status: string };
  schemaVersion: number;
  updatedAt: string;
  version: number;
  /**
   * Present only for a content type with `visibility`. A record of what the
   * visibility was at this version - never something a restore puts back:
   * restoring an old version brings back its *field values*, and a record hidden
   * today stays hidden.
   */
  visibility?: { hiddenAt: null | string; hiddenBy: null | number };
}

export interface ContentTranslationRevisionSnapshot {
  contentTypeId: string;
  createdAt: string;
  /** Every *localized* field, by name. */
  fields: Record<string, ContentSnapshotValue>;
  /** A number for a `serial` record, the canonical string otherwise. */
  itemId: ContentId;
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

export type ContentAnyRevisionSnapshot =
  ContentRevisionSnapshot | ContentTranslationRevisionSnapshot;

/** One revision as the history list shows it - metadata, never the snapshot. */
export interface ContentRevisionMeta {
  /** Display name of the actor, or `null` for a system mutation. */
  actorName: null | string;

  actorRoleColor: null | string;
  actorRolePrefix: null | string;
  actorType: ContentActorType;
  actorUserId: null | number;
  changedFields: string[];
  createdAt: Date | string;
  id: number;
  operation: ContentRevisionOperation;
  restoredFromRevisionId: null | number;
  version: number;
}

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

const sameSnapshotValue = (
  before: ContentSnapshotValue | undefined,
  after: ContentSnapshotValue | undefined,
): boolean => {
  if (before === after) return true;
  if (before === undefined || after === undefined) return false;
  if (typeof before !== "object" || typeof after !== "object") return false;

  return JSON.stringify(before) === JSON.stringify(after);
};

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
