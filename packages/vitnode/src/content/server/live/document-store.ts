import type { Context } from "hono";

import { and, eq, lt, sql } from "drizzle-orm";

import type { ContentLiveDocRef } from "@/content/live/protocol";

import {
  CONTENT_LIVE_SHARED_LOCALE,
  CONTENT_LIVE_STALE_DAYS,
} from "@/content/live/protocol";
import { core_content_documents } from "@/database/content-documents";

import type { ContentDocumentStore } from "./documents";

/**
 * A seed claim older than this is taken over by the next opener: the instance
 * that held it stopped without seeding or releasing it.
 */
export const CONTENT_DOCUMENT_SEED_CLAIM_MS = 30_000;

const table = core_content_documents;

const languageOf = (doc: ContentLiveDocRef): string =>
  doc.locale ?? CONTENT_LIVE_SHARED_LOCALE;

const whereDoc = (doc: ContentLiveDocRef) =>
  and(
    eq(table.contentTypeId, doc.contentTypeId),
    eq(table.itemId, doc.itemId),
    eq(table.field, doc.field),
    eq(table.language, languageOf(doc)),
  );

const isUnseeded = sql`octet_length(${table.state}) = 0`;

const keyOf = (doc: ContentLiveDocRef) => ({
  contentTypeId: doc.contentTypeId,
  field: doc.field,
  itemId: doc.itemId,
  language: languageOf(doc),
});

const conflictTarget = [
  table.contentTypeId,
  table.itemId,
  table.field,
  table.language,
];

/** The `core_content_documents` store, on the request's database handle. */
export const createContentDocumentStore = (
  c: Context,
): ContentDocumentStore => ({
  claimSeed: async doc => {
    const now = new Date();
    // One statement, so two instances cannot both win: the insert succeeds for
    // the first, and the update only takes over an unseeded, stale claim.
    const claimed = await c
      .get("db")
      .insert(table)
      .values({ ...keyOf(doc), state: new Uint8Array(), updatedAt: now })
      .onConflictDoUpdate({
        set: { updatedAt: now },
        setWhere: and(
          isUnseeded,
          lt(
            table.updatedAt,
            new Date(now.getTime() - CONTENT_DOCUMENT_SEED_CLAIM_MS),
          ),
        ),
        target: conflictTarget,
      })
      .returning({ id: table.id });

    return claimed.length > 0;
  },
  deleteRecord: async room => {
    await c
      .get("db")
      .delete(table)
      .where(
        and(
          eq(table.contentTypeId, room.contentTypeId),
          eq(table.itemId, room.itemId),
        ),
      );
  },
  load: async doc => {
    const [row] = await c
      .get("db")
      .select({ state: table.state })
      .from(table)
      .where(whereDoc(doc))
      .limit(1);

    return row && row.state.byteLength > 0 ? row.state : null;
  },
  releaseSeed: async doc => {
    await c
      .get("db")
      .delete(table)
      .where(and(whereDoc(doc), isUnseeded));
  },
  save: async (doc, state, { baseVersion, userId }) => {
    const values = {
      baseVersion,
      state,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    await c
      .get("db")
      .insert(table)
      .values({ ...keyOf(doc), ...values })
      .onConflictDoUpdate({ set: values, target: conflictTarget });
  },
});

/**
 * Delete collaborative documents nobody touched for
 * {@link CONTENT_LIVE_STALE_DAYS} days. Saving the record already committed
 * their content; a later open seeds a fresh document from the record.
 */
export const cleanupStaleContentDocuments = async (
  c: Context,
  { now = new Date() }: { now?: Date } = {},
): Promise<number> => {
  const before = new Date(
    now.getTime() - CONTENT_LIVE_STALE_DAYS * 24 * 60 * 60 * 1000,
  );
  const removed = await c
    .get("db")
    .delete(table)
    .where(lt(table.updatedAt, before))
    .returning({ id: table.id });

  return removed.length;
};
