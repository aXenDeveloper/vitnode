import type { Context } from "hono";

import { and, desc, eq, lte, notInArray, sql } from "drizzle-orm";

import type {
  ContentActor,
  ContentRevisionDetail,
  ContentRevisionMeta,
  ContentRevisionOperation,
  ContentRevisionSnapshot,
} from "../revisions";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";

import { core_content_revisions } from "../../database/content";
import { core_users } from "../../database/users";

export interface ContentRevisionCaptureInput {
  actor: ContentActor;
  changedFields: readonly string[];
  itemId: number;
  operation: ContentRevisionOperation;
  restoredFromRevisionId?: number;
  snapshot: ContentRevisionSnapshot;
  /** The version the record holds after the mutation. */
  version: number;
}

export interface ContentRevisionsModel {
  /**
   * Writes one revision and prunes past the retention window.
   *
   * Takes the transaction explicitly rather than defaulting to the request
   * handle: a revision that is not in the same transaction as the write it
   * describes is a lie waiting to happen.
   */
  capture: (
    tx: ContentDatabase,
    input: ContentRevisionCaptureInput,
  ) => Promise<number>;
  findById: (
    itemId: number,
    revisionId: number,
    tx?: ContentDatabase,
  ) => Promise<ContentRevisionDetail | null>;
  latest: (itemId: number) => Promise<ContentRevisionMeta | null>;
  /** Newest first. Metadata only - a snapshot is loaded on demand. */
  list: (
    itemId: number,
    args?: { cursor?: number; limit?: number },
  ) => Promise<ContentRevisionMeta[]>;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Revision reads and writes for one content type.
 *
 * **Every** statement in here filters on `pluginId`, `contentTypeId` *and*
 * `itemId`. A revision id on its own is never enough: the table is shared by
 * every editorial content type in the install, so trusting an id would let a
 * request for article 7 return - or restore - a revision belonging to some
 * other plugin's record entirely.
 */
export const createContentRevisionsModel = ({
  c,
  definition,
  pluginId,
}: {
  c: Context;
  definition: AnyContentTypeDefinition;
  pluginId: string;
}): ContentRevisionsModel => {
  const contentTypeId = definition.id;
  const retention = definition.editorial.revisions.retention;

  /** The scope predicate. Not optional anywhere, which is the point. */
  const scope = (itemId: number) =>
    and(
      eq(core_content_revisions.pluginId, pluginId),
      eq(core_content_revisions.contentTypeId, contentTypeId),
      eq(core_content_revisions.itemId, itemId),
    );

  const metaSelection = {
    actorName: core_users.name,
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
          operation: input.operation,
          pluginId,
          restoredFromRevisionId: input.restoredFromRevisionId ?? null,
          snapshot: input.snapshot,
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
        // The revision id is the *last* predicate, not the only one.
        .where(and(scope(itemId), eq(core_content_revisions.id, revisionId)))
        .limit(1);

      return row ? row : null;
    },

    latest: async itemId => {
      const [row] = await c
        .get("db")
        .select(metaSelection)
        .from(core_content_revisions)
        .leftJoin(
          core_users,
          eq(core_content_revisions.actorUserId, core_users.id),
        )
        .where(scope(itemId))
        .orderBy(desc(core_content_revisions.version))
        .limit(1);

      return row ? row : null;
    },

    list: async (itemId, { cursor, limit } = {}) => {
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
        .where(
          cursor === undefined
            ? scope(itemId)
            : and(scope(itemId), lte(core_content_revisions.version, cursor)),
        )
        .orderBy(desc(core_content_revisions.version))
        .limit(Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));

      return rows;
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
