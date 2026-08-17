import type { Context } from "hono";

import { and, desc, eq, isNull, lt, lte, notInArray, sql } from "drizzle-orm";

import type {
  ContentActor,
  ContentAnyRevisionSnapshot,
  ContentRevisionDetail,
  ContentRevisionMeta,
  ContentRevisionOperation,
  ContentRevisionSnapshot,
} from "../revisions";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";

import { core_content_revisions } from "../../database/content";
import { core_roles } from "../../database/roles";
import { core_users } from "../../database/users";

export interface ContentRevisionCaptureInput<
  TSnapshot = ContentRevisionSnapshot,
> {
  actor: ContentActor;
  changedFields: readonly string[];
  itemId: number;
  operation: ContentRevisionOperation;
  restoredFromRevisionId?: number;
  snapshot: TSnapshot;
  /** The version the record holds after the mutation. */
  version: number;
}

export interface ContentRevisionsModel<TSnapshot = ContentRevisionSnapshot> {
  /**
   * Writes one revision and prunes past the retention window.
   *
   * Takes the transaction explicitly rather than defaulting to the request
   * handle: a revision that is not in the same transaction as the write it
   * describes is a lie waiting to happen.
   */
  capture: (
    tx: ContentDatabase,
    input: ContentRevisionCaptureInput<TSnapshot>,
  ) => Promise<number>;
  findById: (
    itemId: number,
    revisionId: number,
    tx?: ContentDatabase,
  ) => Promise<ContentRevisionDetail<TSnapshot> | null>;
  /**
   * The newest revision in this scope, or `null` when there is no history.
   *
   * Takes an optional transaction for the same reason `findById` does: a caller
   * deciding what version a write should start at has to read the history from
   * inside the transaction that write is in, or it reads a number another writer
   * is about to take.
   */
  latest: (
    itemId: number,
    tx?: ContentDatabase,
  ) => Promise<ContentRevisionMeta | null>;
  /** Newest first. Metadata only - a snapshot is loaded on demand. */
  list: (
    itemId: number,
    args?: { cursor?: number; limit?: number },
  ) => Promise<ContentRevisionPage>;
}

/**
 * One page of history.
 *
 * `endCursor` is the **version** of the last row returned, not its id: version
 * is what the query orders and filters by, it is unique per record, and it is
 * strictly decreasing down the page. A revision id would be neither ordered nor
 * dense once retention has pruned.
 */
export interface ContentRevisionPage {
  edges: ContentRevisionMeta[];
  pageInfo: {
    endCursor: null | number;
    hasNextPage: boolean;
  };
}

export const CONTENT_REVISIONS_DEFAULT_PAGE_SIZE = 25;
export const CONTENT_REVISIONS_MAX_PAGE_SIZE = 100;

/**
 * Revision reads and writes for one content type, in one language scope.
 *
 * **Every** statement in here filters on `pluginId`, `contentTypeId`, `itemId`
 * *and* `languageId`. A revision id on its own is never enough: the table is
 * shared by every editorial content type in the install, so trusting an id would
 * let a request for article 7 return - or restore - a revision belonging to some
 * other plugin's record entirely. `languageId` joins that list for exactly the
 * same reason one step down: without it, the Polish history could restore the
 * English snapshot.
 *
 * `languageId` defaults to `null`, which is the shared scope - so every Stage 1-4
 * call site keeps the behaviour it had, reading and writing rows the two partial
 * unique indexes treat as the non-localized history.
 */
export const createContentRevisionsModel = <
  TSnapshot = ContentRevisionSnapshot,
>({
  c,
  definition,
  languageId = null,
  pluginId,
}: {
  c: Context;
  definition: AnyContentTypeDefinition;
  /** `null` for the shared history, a `core_languages.id` for one locale's. */
  languageId?: null | number;
  pluginId: string;
}): ContentRevisionsModel<TSnapshot> => {
  const contentTypeId = definition.id;
  const retention = definition.editorial.revisions.retention;

  /** The scope predicate. Not optional anywhere, which is the point. */
  const scope = (itemId: number) =>
    and(
      eq(core_content_revisions.pluginId, pluginId),
      eq(core_content_revisions.contentTypeId, contentTypeId),
      eq(core_content_revisions.itemId, itemId),
      // `IS NULL` rather than `= NULL`: the shared scope is the absence of a
      // language, and an equality against `null` matches nothing in SQL.
      languageId === null
        ? isNull(core_content_revisions.languageId)
        : eq(core_content_revisions.languageId, languageId),
    );

  const metaSelection = {
    actorName: core_users.name,
    actorRoleColor: core_roles.color,
    actorType: core_content_revisions.actorType,
    actorUserId: core_content_revisions.actorUserId,
    changedFields: core_content_revisions.changedFields,
    createdAt: core_content_revisions.createdAt,
    id: core_content_revisions.id,
    operation: core_content_revisions.operation,
    restoredFromRevisionId: core_content_revisions.restoredFromRevisionId,
    version: core_content_revisions.version,
  };

  return {
    capture: async (tx, input) => {
      const [row] = await tx
        .insert(core_content_revisions)
        .values({
          actorType: input.actor.type,
          actorUserId: input.actor.userId,
          changedFields: [...input.changedFields],
          contentTypeId,
          itemId: input.itemId,
          languageId,
          operation: input.operation,
          pluginId,
          restoredFromRevisionId: input.restoredFromRevisionId ?? null,
          snapshot: input.snapshot as ContentAnyRevisionSnapshot,
          version: input.version,
        })
        .returning({ id: core_content_revisions.id });

      // Versions are strictly increasing and unique per record, so "everything
      // at or below `newVersion - retention`" is exactly the set outside the
      // window - one indexed range delete, in the same transaction, with no
      // background job to depend on.
      const keepFrom = input.version - retention;
      if (keepFrom > 0) {
        await tx
          .delete(core_content_revisions)
          .where(
            and(
              scope(input.itemId),
              lte(core_content_revisions.version, keepFrom),
            ),
          );
      }

      return row.id;
    },

    findById: async (itemId, revisionId, tx) => {
      const [row] = await (tx ?? c.get("db"))
        .select({ ...metaSelection, snapshot: core_content_revisions.snapshot })
        .from(core_content_revisions)
        .leftJoin(
          core_users,
          eq(core_content_revisions.actorUserId, core_users.id),
        )
        // Both joins are LEFT: a system revision has no actor, and an actor
        // whose account has since been deleted has no name - neither is a reason
        // to drop the revision itself from the history.
        .leftJoin(core_roles, eq(core_users.roleId, core_roles.id))
        // The revision id is the *last* predicate, not the only one.
        .where(and(scope(itemId), eq(core_content_revisions.id, revisionId)))
        .limit(1);

      // The column holds either snapshot shape; which one is settled by the
      // `languageId` this model was built with, and the scope predicate above has
      // just proven the row matches it.
      return row ? (row as ContentRevisionDetail<TSnapshot>) : null;
    },

    latest: async (itemId, tx) => {
      const [row] = await (tx ?? c.get("db"))
        .select(metaSelection)
        .from(core_content_revisions)
        .leftJoin(
          core_users,
          eq(core_content_revisions.actorUserId, core_users.id),
        )
        // Both joins are LEFT: a system revision has no actor, and an actor
        // whose account has since been deleted has no name - neither is a reason
        // to drop the revision itself from the history.
        .leftJoin(core_roles, eq(core_users.roleId, core_roles.id))
        .where(scope(itemId))
        .orderBy(desc(core_content_revisions.version))
        .limit(1);

      return row ? row : null;
    },

    list: async (itemId, { cursor, limit } = {}) => {
      const size = Math.min(
        Math.max(limit ?? CONTENT_REVISIONS_DEFAULT_PAGE_SIZE, 1),
        CONTENT_REVISIONS_MAX_PAGE_SIZE,
      );

      // One LEFT JOIN resolves every author in the same round trip - opening the
      // history must not cost one query per row.
      const rows = await c
        .get("db")
        .select(metaSelection)
        .from(core_content_revisions)
        .leftJoin(
          core_users,
          eq(core_content_revisions.actorUserId, core_users.id),
        )
        // Both joins are LEFT: a system revision has no actor, and an actor
        // whose account has since been deleted has no name - neither is a reason
        // to drop the revision itself from the history.
        .leftJoin(core_roles, eq(core_users.roleId, core_roles.id))
        .where(
          cursor === undefined
            ? scope(itemId)
            : // Strictly less than, not `<=`. The cursor is the last version
              // the caller already has, so including it again would repeat one
              // row on every page boundary - and the AdminCP, which appends,
              // would show it twice.
              and(scope(itemId), lt(core_content_revisions.version, cursor)),
        )
        .orderBy(desc(core_content_revisions.version))
        // One more than asked for: whether another page exists is a fact about
        // the data, and reading one extra row is cheaper than a COUNT and
        // cannot disagree with the rows just returned.
        .limit(size + 1);

      const edges = rows.slice(0, size);

      return {
        edges,
        pageInfo: {
          endCursor: edges.at(-1)?.version ?? null,
          hasNextPage: rows.length > size,
        },
      };
    },
  };
};

/**
 * Removes revisions whose content type is no longer registered.
 *
 * Retention pruning happens inline, in the write's own transaction, so this
 * handles only the case that one structurally cannot: a content type that
 * dropped `editorial`, or a plugin that went away. Nothing will ever write to
 * those rows again, so nothing would ever prune them.
 */
export const pruneContentRevisions = async ({
  db,
  knownContentTypeIds,
}: {
  db: ContentDatabase;
  knownContentTypeIds: string[];
}): Promise<{ orphaned: number }> => {
  const rows = await db
    .delete(core_content_revisions)
    .where(
      // An empty list genuinely means "no content type keeps history any more".
      // `notInArray` with an empty array is not valid SQL, hence the branch.
      knownContentTypeIds.length === 0
        ? sql`true`
        : notInArray(core_content_revisions.contentTypeId, knownContentTypeIds),
    )
    .returning({ id: core_content_revisions.id });

  return { orphaned: rows.length };
};
