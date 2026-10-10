import type { Context } from "hono";

import { and, eq, gt, inArray, lt, lte, or, sql } from "drizzle-orm";

import type { ContentDraft, ContentDrafts } from "../live/http";
import type { ContentFieldLock, ContentLiveRoomRef } from "../live/protocol";
import type { ContentDatabase } from "./service";

import {
  core_content_drafts,
  core_content_field_locks,
} from "../../database/content-drafts";
import { core_users } from "../../database/users";
import {
  CONTENT_FIELD_LOCK_LEASE_MS,
  CONTENT_LIVE_SHARED_LOCALE,
  CONTENT_LIVE_STALE_DAYS,
} from "../live/protocol";
import { broadcastContentLive } from "./live/broadcast";
import { onContentLiveReset, onContentLiveUserLeft } from "./live/hooks";
import { findContentModel } from "./model";

const DAY_MS = 24 * 60 * 60 * 1000;

const locks = core_content_field_locks;
const drafts = core_content_drafts;

const contentLiveLanguage = (locale: null | string): string =>
  locale ?? CONTENT_LIVE_SHARED_LOCALE;

const localeOf = (language: string): null | string =>
  language === CONTENT_LIVE_SHARED_LOCALE ? null : language;

const inRoom = (
  table: typeof core_content_drafts | typeof core_content_field_locks,
  { contentTypeId, itemId }: ContentLiveRoomRef,
) => and(eq(table.contentTypeId, contentTypeId), eq(table.itemId, itemId));

export interface ContentFieldLockKey extends ContentLiveRoomRef {
  field: string;
  locale: null | string;
}

const lockKey = (key: ContentFieldLockKey) =>
  and(
    inRoom(locks, key),
    eq(locks.field, key.field),
    eq(locks.language, contentLiveLanguage(key.locale)),
  );

const lockSelection = {
  expiresAt: locks.expiresAt,
  field: locks.field,
  language: locks.language,
  userId: locks.userId,
  userName: core_users.name,
};

const toLock = (row: {
  expiresAt: Date;
  field: string;
  language: string;
  userId: number;
  userName: null | string;
}): ContentFieldLock => ({
  expiresAt: new Date(row.expiresAt).toISOString(),
  field: row.field,
  locale: localeOf(row.language),
  user: { id: row.userId, name: row.userName ?? "" },
});

export const listContentFieldLocks = async (
  db: ContentDatabase,
  room: ContentLiveRoomRef,
  now = new Date(),
): Promise<ContentFieldLock[]> => {
  const rows = await db
    .select(lockSelection)
    .from(locks)
    .leftJoin(core_users, eq(core_users.id, locks.userId))
    .where(and(inRoom(locks, room), gt(locks.expiresAt, now)))
    .orderBy(locks.field, locks.language);

  return rows.map(toLock);
};

export const findContentFieldLock = async (
  db: ContentDatabase,
  key: ContentFieldLockKey,
  now = new Date(),
): Promise<ContentFieldLock | null> => {
  const [row] = await db
    .select(lockSelection)
    .from(locks)
    .leftJoin(core_users, eq(core_users.id, locks.userId))
    .where(and(lockKey(key), gt(locks.expiresAt, now)))
    .limit(1);

  return row ? toLock(row) : null;
};

export const acquireContentFieldLock = async (
  db: ContentDatabase,
  key: ContentFieldLockKey,
  userId: number,
  now = new Date(),
): Promise<boolean> => {
  const expiresAt = new Date(now.getTime() + CONTENT_FIELD_LOCK_LEASE_MS);

  const rows = await db
    .insert(locks)
    .values({
      acquiredAt: now,
      contentTypeId: key.contentTypeId,
      expiresAt,
      field: key.field,
      itemId: key.itemId,
      language: contentLiveLanguage(key.locale),
      userId,
    })
    .onConflictDoUpdate({
      set: { acquiredAt: now, expiresAt, userId },
      target: [locks.contentTypeId, locks.itemId, locks.field, locks.language],
      where: or(lt(locks.expiresAt, now), eq(locks.userId, userId)),
    })
    .returning({ id: locks.id });

  return rows.length > 0;
};

export const renewContentFieldLock = async (
  db: ContentDatabase,
  key: ContentFieldLockKey,
  userId: number,
  now = new Date(),
): Promise<boolean> => {
  const rows = await db
    .update(locks)
    .set({ expiresAt: new Date(now.getTime() + CONTENT_FIELD_LOCK_LEASE_MS) })
    .where(and(lockKey(key), eq(locks.userId, userId)))
    .returning({ id: locks.id });

  return rows.length > 0;
};

export const releaseContentFieldLock = async (
  db: ContentDatabase,
  key: ContentFieldLockKey,
  userId: number,
): Promise<boolean> => {
  const rows = await db
    .delete(locks)
    .where(and(lockKey(key), eq(locks.userId, userId)))
    .returning({ id: locks.id });

  return rows.length > 0;
};

export const heldContentFieldLocks = async (
  db: ContentDatabase,
  {
    locale,
    names,
    room,
    userId,
  }: {
    locale: null | string;
    names: readonly string[];
    room: ContentLiveRoomRef;
    userId: number;
  },
  now = new Date(),
): Promise<Set<string>> => {
  if (names.length === 0) return new Set();

  const rows = await db
    .select({ field: locks.field })
    .from(locks)
    .where(
      and(
        inRoom(locks, room),
        eq(locks.language, contentLiveLanguage(locale)),
        eq(locks.userId, userId),
        gt(locks.expiresAt, now),
        inArray(locks.field, [...names]),
      ),
    );

  return new Set(rows.map(row => row.field));
};

export const broadcastContentFieldLocks = async (
  db: ContentDatabase,
  room: ContentLiveRoomRef,
): Promise<ContentFieldLock[]> => {
  const list = await listContentFieldLocks(db, room);
  broadcastContentLive(room, { locks: list, room, type: "locks" });

  return list;
};

export const readContentDrafts = async (
  db: ContentDatabase,
  room: ContentLiveRoomRef,
): Promise<ContentDrafts> => {
  const rows = await db
    .select({
      baseVersion: drafts.baseVersion,
      language: drafts.language,
      updatedAt: drafts.updatedAt,
      updatedById: drafts.updatedBy,
      updatedByName: core_users.name,
      values: drafts.values,
    })
    .from(drafts)
    .leftJoin(core_users, eq(core_users.id, drafts.updatedBy))
    .where(inRoom(drafts, room));

  const result: ContentDrafts = { shared: null, translations: {} };
  for (const row of rows) {
    const draft: ContentDraft = {
      baseVersion: row.baseVersion,
      updatedAt: new Date(row.updatedAt).toISOString(),
      updatedBy:
        row.updatedById === null
          ? null
          : { id: row.updatedById, name: row.updatedByName ?? "" },
      values: row.values,
    };
    const locale = localeOf(row.language);

    if (locale === null) result.shared = draft;
    else result.translations[locale] = draft;
  }

  return result;
};

export const writeContentDraft = async (
  db: ContentDatabase,
  {
    baseVersion,
    locale,
    room,
    userId,
    values,
  }: {
    baseVersion: number;
    locale: null | string;
    room: ContentLiveRoomRef;
    userId: number;
    values: Record<string, unknown>;
  },
  now = new Date(),
): Promise<Date> => {
  await db
    .insert(drafts)
    .values({
      baseVersion,
      contentTypeId: room.contentTypeId,
      itemId: room.itemId,
      language: contentLiveLanguage(locale),
      updatedAt: now,
      updatedBy: userId,
      values,
    })
    .onConflictDoUpdate({
      set: {
        baseVersion,
        updatedAt: now,
        updatedBy: userId,
        values: sql`${drafts.values} || ${JSON.stringify(values)}::jsonb`,
      },
      target: [drafts.contentTypeId, drafts.itemId, drafts.language],
    });

  return now;
};

export const commitContentDrafts = async (
  c: Context,
  room: ContentLiveRoomRef,
  {
    locales,
    savedFrom,
  }: { locales: readonly (null | string)[]; savedFrom: Date },
): Promise<void> => {
  if (locales.length === 0) return;

  const db: ContentDatabase = c.get("db");
  try {
    const committed = await db
      .delete(drafts)
      .where(
        and(
          inRoom(drafts, room),
          inArray(drafts.language, locales.map(contentLiveLanguage)),
          lte(drafts.updatedAt, savedFrom),
        ),
      )
      .returning({ id: drafts.id });

    if (committed.length > 0) {
      broadcastContentLive(room, { room, type: "committed" });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Content draft commit failed:", error);
  }
};

const deleteContentLiveState = async (
  db: ContentDatabase,
  room: ContentLiveRoomRef,
): Promise<void> => {
  await db.delete(drafts).where(inRoom(drafts, room));
  await db.delete(locks).where(inRoom(locks, room));
};

const deleteUserContentFieldLocks = async (
  db: ContentDatabase,
  room: ContentLiveRoomRef,
  userId: number,
): Promise<number> => {
  const rows = await db
    .delete(locks)
    .where(and(inRoom(locks, room), eq(locks.userId, userId)))
    .returning({ id: locks.id });

  return rows.length;
};

export const cleanupStaleContentDrafts = async (
  c: Context,
  now = new Date(),
): Promise<{ drafts: number; locks: number }> => {
  const db: ContentDatabase = c.get("db");

  const expired = await db
    .delete(locks)
    .where(lt(locks.expiresAt, now))
    .returning({ id: locks.id });

  const stale = await db
    .select({
      baseVersion: drafts.baseVersion,
      contentTypeId: drafts.contentTypeId,
      id: drafts.id,
      itemId: drafts.itemId,
      language: drafts.language,
    })
    .from(drafts)
    .where(
      lt(
        drafts.updatedAt,
        new Date(now.getTime() - CONTENT_LIVE_STALE_DAYS * DAY_MS),
      ),
    );

  const models = c.get("core")?.contentModels ?? [];
  const doomed: number[] = [];

  for (const draft of stale) {
    const entry = findContentModel(models, draft.contentTypeId);
    if (!entry) {
      doomed.push(draft.id);
      continue;
    }

    const locale = localeOf(draft.language);
    const record = await entry.model.service(c).findRowById(draft.itemId);
    if (!record) {
      doomed.push(draft.id);
      continue;
    }

    if (locale === null) {
      const version: unknown = Reflect.get(record, "version");
      if (typeof version === "number" && version > draft.baseVersion) {
        doomed.push(draft.id);
      }
      continue;
    }

    const translation = await entry.model
      .translationService?.(c)
      .findByLocale(draft.itemId, locale);
    if (
      translation
        ? translation.version > draft.baseVersion
        : draft.baseVersion > 0
    ) {
      doomed.push(draft.id);
    }
  }

  if (doomed.length > 0) {
    await db.delete(drafts).where(inArray(drafts.id, doomed));
  }

  return { drafts: doomed.length, locks: expired.length };
};

onContentLiveUserLeft(async ({ c, room, userId }) => {
  const db: ContentDatabase = c.get("db");
  const removed = await deleteUserContentFieldLocks(db, room, userId);
  if (removed > 0) await broadcastContentFieldLocks(db, room);
});

onContentLiveReset(async ({ c, room }) => {
  await deleteContentLiveState(c.get("db"), room);
});
