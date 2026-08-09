import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";

import { core_content_slug_history } from "../../database/content";
import { contentDeliveryPath } from "../delivery";
import { ContentDeliverySlugReserved } from "../errors";

/**
 * One retired or current public address of one record.
 *
 * The AdminCP shows these, the resolver reads them and an audit reads them long
 * after the record is gone. `retiredAt === null` means "this is the address the
 * record answers to now"; anything else is a URL that redirects to it.
 */
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

/**
 * One address of one record, as every write names it.
 *
 * `languageId` is the storage key and `locale` is what an error message says out
 * loud - both, because the two are needed at different layers and deriving one
 * from the other here would mean a language lookup inside a transaction that
 * already knows the answer.
 */
export interface ContentSlugHistoryTarget {
  itemId: number;
  /** `null` for a shared slug - see `core_content_slug_history`. */
  languageId: null | number;
  /** The canonical `core_languages.code`, or `null` when the slug is shared. */
  locale: null | string;
  slug: string;
}

/**
 * The persistence half of slug history: reservations in, lookups out.
 *
 * Every write takes the transaction it should run in, and none of them opens one.
 * That is the whole design constraint: the slug mutation, the reservation and the
 * revision have to commit or roll back together, so this module can never be the
 * thing that decides when that happens. `editorial-service` and
 * `translation-editorial-service` own the transaction and call in.
 *
 * There is deliberately no `delete`. A retired URL is somebody's bookmark, and
 * removing the row would let unrelated content inherit it - so the only way
 * history shrinks is a deliberate, permissioned AdminCP action, which Stage 8 does
 * not ship.
 */
export interface ContentSlugHistoryModel {
  /**
   * Refuses a slug that another record's history already owns.
   *
   * Called **before** the write it guards, so an editor is told at save time
   * rather than at publish time - and so the failing transaction has done as
   * little as possible. A slug this same record already owns is fine: moving from
   * `b` back to `a` re-activates its own retired reservation rather than colliding
   * with it.
   */
  assertAvailable: (
    tx: ContentDatabase,
    args: ContentSlugHistoryTarget,
  ) => Promise<void>;
  /**
   * Records an address the caller can **prove** was live, if it is not on file.
   *
   * The lazy half of slug history, and the reason Stage 8 needs no backfill
   * migration. A record published before this table existed has no row at all, so
   * the first mutation that moves it off that address would find nothing to
   * retire - and `/articles/hello` would be lost the moment somebody renamed it.
   * A global backfill is not the answer: it would have to guess which historical
   * values were ever public, and a draft's discarded slug must never become a
   * redirect. The mutation itself does not have to guess. It is holding the row on
   * both sides of its own write, so `wasPublic` is evidence rather than inference,
   * and this is where that evidence is spent.
   *
   * Distinct from {@link reserve} in one deliberate way: a row that already exists
   * is left **exactly** as it is, retired or not. This establishes a missing fact;
   * it never brings a retired address back into service, which is `reserve`'s job
   * and only correct when the record really is live there.
   *
   * Idempotent, transactional, and throws {@link ContentDeliverySlugReserved} when
   * another record owns the address. Writes nothing but the row: no event, no
   * cache tag, no search document.
   */
  ensureCurrent: (
    tx: ContentDatabase,
    args: ContentSlugHistoryTarget & {
      /** The path that address served, recorded as the historical fact it is. */
      path: string;
    },
  ) => Promise<{ created: boolean }>;
  /**
   * Every address one record has ever had, newest first.
   *
   * Scoped by language when one is given, which is what makes the AdminCP's Polish
   * tab show Polish URLs and nothing else.
   */
  list: (
    args: { itemId: number; languageId?: null | number; limit?: number },
    database?: ContentDatabase,
  ) => Promise<ContentSlugHistoryEntry[]>;
  /**
   * The record a retired (or current) address belongs to, or `null`.
   *
   * The resolver's one lookup, and the reason the two partial unique indexes lead
   * with `(contentTypeId, slug)`: this runs on a public request path for a URL that
   * is very often a typo, so it has to be an index hit rather than a scan.
   */
  owner: (
    args: { languageId: null | number; slug: string },
    database?: ContentDatabase,
  ) => Promise<ContentSlugHistoryEntry | null>;
  /**
   * Records one slug as the record's **current** public address.
   *
   * Idempotent: a republish of an unchanged slug re-activates the row it already
   * has rather than inserting a second one, which is what keeps a retried queue
   * task and a double-clicked publish button harmless.
   *
   * Throws {@link ContentDeliverySlugReserved} when another record owns the
   * address, whichever order two concurrent writers arrive in - see the `claim`
   * helper for why that is an insert rather than a check.
   */
  reserve: (
    tx: ContentDatabase,
    args: ContentSlugHistoryTarget & {
      /** The path this slug produced, recorded as the historical fact it is. */
      path: string;
    },
  ) => Promise<{ created: boolean }>;
  /**
   * Stamps one of a record's own addresses as no longer current.
   *
   * `{ retired: true }` only when a row was actually there and actually active,
   * which is precisely the "this URL was publicly addressable" test: a draft whose
   * slug was corrected three times before it was ever published has no row to
   * retire, so it creates no redirect and emits no event.
   */
  retire: (
    tx: ContentDatabase,
    args: Omit<ContentSlugHistoryTarget, "locale">,
  ) => Promise<{ retired: boolean }>;
}

const HISTORY_LIST_LIMIT = 50;

/**
 * The language predicate, written the one way that is correct for both cases.
 *
 * `IS NULL` for a shared slug and `=` for a localized one: `languageId = NULL` is
 * `NULL` in SQL, never `true`, so an equality comparison would silently match no
 * shared row at all - and a shared reservation that matches nothing is a
 * reservation that reserves nothing.
 */
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

  /**
   * Takes one address for one record, or says who already has it.
   *
   * **Insert first, ask afterwards**, and that ordering is the whole point.
   * `SELECT ... FOR UPDATE` locks rows that exist; there is no such thing as
   * locking a row that does not. So two transactions reserving one *previously
   * unseen* address both read nothing, both decide the address is free, and both
   * insert - one of them straight into a `23505` from the partial unique index.
   * The database stays consistent, but the contract does not: the loser gets a raw
   * driver failure that the shared mapper reads as a generic unique clash, where
   * Stage 8 promises `CONTENT_DELIVERY_SLUG_RESERVED` naming the slug and the
   * locale. Which of the two a caller saw depended on timing.
   *
   * `ON CONFLICT DO NOTHING` moves the decision into the one place that can make
   * it. The second insert takes a speculative-insertion lock, waits for the first
   * transaction to finish, and then either does nothing (it committed) or inserts
   * after all (it rolled back). `RETURNING` reports which happened, so the loser is
   * identified rather than caught, and the address is never claimed by two writers.
   *
   * The follow-up read still takes `FOR UPDATE`: the row exists by then, and
   * locking it is what serialises this claim against a concurrent `retire` of the
   * same row.
   */
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

/**
 * The current address of several records at once, keyed by identifier.
 *
 * Batched rather than one query per record, because the AdminCP list and a sitemap
 * page both want a whole page's worth - and the alternative is the classic query
 * per row that only shows up as a problem in production.
 */
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

/**
 * The path one slug produces, or the empty string when it produces none.
 *
 * A thin wrapper over {@link contentDeliveryPath} for the write paths, which have
 * to store *something* in a `NOT NULL` column. An unbuildable path means the slug
 * was never addressable, so the caller does not reserve it at all - and this
 * returning `""` rather than throwing keeps that decision in the caller where the
 * surrounding transaction is.
 */
export const contentSlugHistoryPath = ({
  definition,
  locale,
  slug,
}: {
  definition: AnyContentTypeDefinition;
  locale: null | string;
  slug: string;
}): string => contentDeliveryPath({ definition, locale, slug }) ?? "";
