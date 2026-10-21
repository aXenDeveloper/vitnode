import type { Context } from "hono";

import { and, eq, lt, sql } from "drizzle-orm";
import * as Y from "yjs";

import type { ContentLiveDocRef } from "@/content/live/protocol";

import { contentIdKey } from "@/content/ids";
import {
  CONTENT_LIVE_SHARED_LOCALE,
  CONTENT_LIVE_STALE_DAYS,
} from "@/content/live/protocol";
import { core_content_documents } from "@/database/content-documents";

import type { ContentDocumentStore } from "./documents";

const CONTENT_DOCUMENT_SEED_CLAIM_MS = 30_000;

const table = core_content_documents;

const languageOf = (doc: ContentLiveDocRef): string =>
  doc.locale ?? CONTENT_LIVE_SHARED_LOCALE;

const whereDoc = (doc: ContentLiveDocRef) =>
  and(
    eq(table.contentTypeId, doc.contentTypeId),
    eq(table.itemId, contentIdKey(doc.itemId)),
    eq(table.field, doc.field),
    eq(table.language, languageOf(doc)),
  );

const isUnseeded = sql`octet_length(${table.state}) = 0`;

const keyOf = (doc: ContentLiveDocRef) => ({
  contentTypeId: doc.contentTypeId,
  field: doc.field,
  itemId: contentIdKey(doc.itemId),
  language: languageOf(doc),
});

const conflictTarget = [
  table.contentTypeId,
  table.itemId,
  table.field,
  table.language,
];

export const createContentDocumentStore = (
  c: Context,
): ContentDocumentStore => ({
  claimSeed: async doc => {
    const now = new Date();
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
          eq(table.itemId, contentIdKey(room.itemId)),
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

export const cleanupStaleContentDocuments = async (
  c: Context,
): Promise<number> => {
  const before = new Date(
    Date.now() - CONTENT_LIVE_STALE_DAYS * 24 * 60 * 60 * 1000,
  );
  const removed = await c
    .get("db")
    .delete(table)
    .where(lt(table.updatedAt, before))
    .returning({ id: table.id });

  return removed.length;
};

export const patchStoredContentDocuments = async (
  c: Context,
  {
    mutate,
    skip,
  }: {
    mutate: (doc: Y.Doc) => boolean;
    skip: (ref: ContentLiveDocRef) => boolean;
  },
): Promise<{ ref: ContentLiveDocRef; update: Uint8Array }[]> => {
  const db = c.get("db");
  const rows = await db
    .select({
      contentTypeId: table.contentTypeId,
      field: table.field,
      id: table.id,
      itemId: table.itemId,
      language: table.language,
      state: table.state,
    })
    .from(table)
    .where(sql`octet_length(${table.state}) > 0`);

  const patched: { ref: ContentLiveDocRef; update: Uint8Array }[] = [];
  for (const row of rows) {
    const ref: ContentLiveDocRef = {
      contentTypeId: row.contentTypeId,
      field: row.field,
      itemId: row.itemId,
      locale: row.language === CONTENT_LIVE_SHARED_LOCALE ? null : row.language,
    };
    if (skip(ref)) continue;

    const doc = new Y.Doc({ gc: true });
    Y.applyUpdate(doc, row.state);
    const before = Y.encodeStateVector(doc);
    if (!mutate(doc)) continue;

    await db
      .update(table)
      .set({ state: Y.encodeStateAsUpdate(doc), updatedAt: new Date() })
      .where(eq(table.id, row.id));
    patched.push({ ref, update: Y.encodeStateAsUpdate(doc, before) });
  }

  return patched;
};
