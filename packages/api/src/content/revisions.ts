import type {
  CONTENT_ACTOR_TYPES,
  CONTENT_REVISION_OPERATIONS,
  CONTENT_TRANSLATION_REVISION_OPERATIONS,
} from "./const";
import type { ContentId } from "./ids";
import type { RichTextDocument } from "./rich-text/document";

export type ContentRevisionOperation =
  (typeof CONTENT_REVISION_OPERATIONS)[number];

export type ContentTranslationRevisionOperation =
  (typeof CONTENT_TRANSLATION_REVISION_OPERATIONS)[number];

export type ContentActorType = (typeof CONTENT_ACTOR_TYPES)[number];

/** Who made a content write, as recorded on its revision. `userId` is `null` for system writes. */
export interface ContentActor {
  type: ContentActorType;
  userId: null | number;
}

export type ContentSnapshotScalar = boolean | null | number | string;

export type ContentSnapshotValue =
  | ContentId[]
  | ContentSnapshotScalar
  | Record<string, ContentSnapshotScalar>
  | Record<string, ContentSnapshotScalar>[]
  | RichTextDocument;

/**
 * The state of a record's shared fields - to-many relations and repeatables
 * included - after one editorial write, as stored in a revision. Values are JSON-safe (dates as ISO strings). A
 * localized content type keeps its translations' history in
 * {@link ContentTranslationRevisionSnapshot} instead.
 */
export interface ContentRevisionSnapshot {
  contentTypeId: string;
  createdAt: string;
  /** Every declared field, by name. */
  fields: Record<string, ContentSnapshotValue>;
  id: ContentId;
  /** Present only for a content type with the publication lifecycle. */
  publication?: { publishedAt: null | string; status: string };
  schemaVersion: number;
  updatedAt: string;
  version: number;
  visibility?: { hiddenAt: null | string; hiddenBy: null | number };
}

/** The state of one translation after one editorial write. */
export interface ContentTranslationRevisionSnapshot {
  contentTypeId: string;
  createdAt: string;
  /** Every *localized* field, by name. */
  fields: Record<string, ContentSnapshotValue>;
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
  | ContentRevisionSnapshot
  | ContentTranslationRevisionSnapshot;

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

/**
 * The fields among `names` whose value differs between two snapshots. With no
 * `before` (the first revision), every named field is listed.
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
