import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";

import { core_content_slug_history } from "../../database/content";
import { contentDeliveryPath } from "../delivery";
import { ContentDeliverySlugReserved } from "../errors";

export interface ContentSlugHistoryEntry {
  createdAt: Date;
  itemId: number;
  /** `null` for a shared slug - see `core_content_slug_history`. */
  languageId: null | number;
  /** The URL that was live, exactly as it was live. */
  path: string;
  retiredAt: Date | null;
  slug: string;
}

export interface ContentSlugHistoryTarget {
  itemId: number;
  /** `null` for a shared slug - see `core_content_slug_history`. */
  languageId: null | number;
  /** The canonical `core_languages.code`, or `null` when the slug is shared. */
  locale: null | string;
  slug: string;
}

export interface ContentSlugHistoryModel {
  assertAvailable: (
    tx: ContentDatabase,
    args: ContentSlugHistoryTarget,
  ) => Promise<void>;

  ensureCurrent: (
    tx: ContentDatabase,
    args: ContentSlugHistoryTarget & {
      /** The path that address served, recorded as the historical fact it is. */
      path: string;
    },
  ) => Promise<{ created: boolean }>;

  list: (
    args: { itemId: number; languageId?: null | number; limit?: number },
    database?: ContentDatabase,
  ) => Promise<ContentSlugHistoryEntry[]>;

  owner: (
    args: { languageId: null | number; slug: string },
    database?: ContentDatabase,
  ) => Promise<ContentSlugHistoryEntry | null>;

  reserve: (
    tx: ContentDatabase,
    args: ContentSlugHistoryTarget & {
      /** The path this slug produced, recorded as the historical fact it is. */
      path: string;
    },
  ) => Promise<{ created: boolean }>;

  retire: (
    tx: ContentDatabase,
    args: Omit<ContentSlugHistoryTarget, "locale">,
  ) => Promise<{ retired: boolean }>;
}

const HISTORY_LIST_LIMIT = 50;

const languageCondition = (
  languageId: null | number,
  column: typeof core_content_slug_history.languageId,
): SQL => (languageId === null ? isNull(column) : eq(column, languageId));

const toEntry = (row: {
  createdAt: Date;
  itemId: number;
  languageId: null | number;
  path: string;
  retiredAt: Date | null;
  slug: string;
}): ContentSlugHistoryEntry => ({
  createdAt: row.createdAt,
  itemId: row.itemId,
  languageId: row.languageId,
  path: row.path,
  retiredAt: row.retiredAt,
  slug: row.slug,
});

const ENTRY_COLUMNS = {
  createdAt: core_content_slug_history.createdAt,
  itemId: core_content_slug_history.itemId,
  languageId: core_content_slug_history.languageId,
  path: core_content_slug_history.path,
  retiredAt: core_content_slug_history.retiredAt,
  slug: core_content_slug_history.slug,
};

export const createContentSlugHistoryModel = ({
  c,
  definition,
  pluginId,
}: {
  c: Context;
  definition: AnyContentTypeDefinition;
  pluginId: string;
}): ContentSlugHistoryModel => {
  const contentTypeId = definition.id;
  const scope = eq(core_content_slug_history.contentTypeId, contentTypeId);

  const findOwner = async (
    database: ContentDatabase,
    { languageId, slug }: { languageId: null | number; slug: string },
    { lock = false }: { lock?: boolean } = {},
  ): Promise<ContentSlugHistoryEntry | null> => {
    const query = database
      .select(ENTRY_COLUMNS)
      .from(core_content_slug_history)
      .where(
        and(
          scope,
          eq(core_content_slug_history.slug, slug),
          languageCondition(languageId, core_content_slug_history.languageId),
        ),
      )
      .limit(1);

    const [row] = lock ? await query.for("update") : await query;

    return row ? toEntry(row) : null;
  };

  const claim = async (
    tx: ContentDatabase,
    {
      itemId,
      languageId,
      locale,
      path,
      slug,
    }: ContentSlugHistoryTarget & { path: string },
  ): Promise<{ created: boolean }> => {
    const [inserted] = await tx
      .insert(core_content_slug_history)
      .values({ contentTypeId, itemId, languageId, path, pluginId, slug })
      .onConflictDoNothing()
      .returning({ id: core_content_slug_history.id });

    if (inserted) return { created: true };

    const owner = await findOwner(tx, { languageId, slug }, { lock: true });

    // A missing owner here means the row that blocked the insert is not visible to
    // this transaction's snapshot. Under READ COMMITTED that cannot happen - the
    // insert waited for the other transaction and the next statement sees its
    // commit - and under a stricter isolation level it means somebody else has the
    // address and we simply cannot see them yet. Either way this transaction did
    // not get it, and refusing is the only answer that is never wrong.
    if (owner?.itemId !== itemId) {
      throw new ContentDeliverySlugReserved({ contentTypeId, locale, slug });
    }

    return { created: false };
  };

  return {
    assertAvailable: async (tx, { itemId, languageId, locale, slug }) => {
      const owner = await findOwner(tx, { languageId, slug });
      if (owner === null || owner.itemId === itemId) return;

      throw new ContentDeliverySlugReserved({ contentTypeId, locale, slug });
    },

    // Establish and stop. A row that is already here is left as it stands - a
    // retired address stays retired, because this call means "this was live once"
    // and never "this is live now".
    ensureCurrent: async (tx, args) => await claim(tx, args),

    list: async ({ itemId, languageId, limit }, database) => {
      const conditions = [scope, eq(core_content_slug_history.itemId, itemId)];
      if (languageId !== undefined) {
        conditions.push(
          languageCondition(languageId, core_content_slug_history.languageId),
        );
      }

      const rows = await (database ?? c.get("db"))
        .select(ENTRY_COLUMNS)
        .from(core_content_slug_history)
        .where(and(...conditions))
        // Current address first, then the retired ones newest to oldest: that is
        // the order somebody reading the panel wants, and `id` breaks the tie so
        // two rows created in the same millisecond do not swap places between
        // reads.
        .orderBy(
          asc(core_content_slug_history.retiredAt),
          desc(core_content_slug_history.id),
        )
        .limit(Math.min(limit ?? HISTORY_LIST_LIMIT, HISTORY_LIST_LIMIT));

      return rows.map(toEntry);
    },

    owner: async (args, database) =>
      await findOwner(database ?? c.get("db"), args),

    reserve: async (tx, args) => {
      const { created } = await claim(tx, args);
      if (created) return { created: true };

      const { itemId, languageId, path, slug } = args;

      // Its own row, coming back into service: a slug that moved away and then
      // moved back, or a republish of the address it already had. `path` is
      // rewritten as well as `retiredAt`, because a content type whose
      // `publicApi.path` changed serves the address from a different prefix now.
      await tx
        .update(core_content_slug_history)
        .set({ path, retiredAt: null })
        .where(
          and(
            scope,
            eq(core_content_slug_history.itemId, itemId),
            eq(core_content_slug_history.slug, slug),
            languageCondition(languageId, core_content_slug_history.languageId),
          ),
        );

      return { created: false };
    },

    retire: async (tx, { itemId, languageId, slug }) => {
      const rows = await tx
        .update(core_content_slug_history)
        .set({ retiredAt: sql`now()` })
        .where(
          and(
            scope,
            eq(core_content_slug_history.itemId, itemId),
            eq(core_content_slug_history.slug, slug),
            languageCondition(languageId, core_content_slug_history.languageId),
            // Only an *active* row is retired. A slug already marked historical
            // keeps the moment it stopped being live, which is the only timestamp
            // that means anything to an audit.
            isNull(core_content_slug_history.retiredAt),
          ),
        )
        .returning({ id: core_content_slug_history.id });

      return { retired: rows.length > 0 };
    },
  };
};

export const contentSlugHistoryCurrentPaths = async (
  database: ContentDatabase,
  {
    contentTypeId,
    itemIds,
    languageId,
  }: {
    contentTypeId: string;
    itemIds: readonly number[];
    languageId: null | number;
  },
): Promise<Map<number, string>> => {
  if (itemIds.length === 0) return new Map();

  const rows = await database
    .select({
      itemId: core_content_slug_history.itemId,
      path: core_content_slug_history.path,
    })
    .from(core_content_slug_history)
    .where(
      and(
        eq(core_content_slug_history.contentTypeId, contentTypeId),
        inArray(core_content_slug_history.itemId, [...itemIds]),
        languageCondition(languageId, core_content_slug_history.languageId),
        isNull(core_content_slug_history.retiredAt),
      ),
    );

  return new Map(rows.map(row => [row.itemId, row.path]));
};

export const contentSlugHistoryPath = ({
  definition,
  locale,
  slug,
}: {
  definition: AnyContentTypeDefinition;
  locale: null | string;
  slug: string;
}): string => contentDeliveryPath({ definition, locale, slug }) ?? "";
