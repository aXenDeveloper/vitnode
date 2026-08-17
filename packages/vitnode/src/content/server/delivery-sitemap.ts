import type { SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, eq, gt, sql } from "drizzle-orm";

import type { ContentSitemapEntry } from "../sitemap";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDeliverySitemapArgs } from "./delivery-service";
import type { ContentModel } from "./model";

import {
  CONTENT_SITEMAP_DEFAULT_PAGE_SIZE,
  CONTENT_SITEMAP_MAX_URLS,
} from "../const";
import { contentDeliveryPath } from "../delivery";
import { ContentDeliveryNotEnabled } from "../errors";
import { splitContentFieldPath } from "../paths";
import { findContentLanguage } from "./language-resolver";
import {
  contentTranslationPublicationColumns,
  publicationColumns,
  publishedCondition,
} from "./publication";

/**
 * One page of a content type's sitemap.
 *
 * `nextCursor` rather than a page number, and `null` rather than `hasNextPage` on
 * its own: a sitemap is regenerated from scratch every time a crawler asks, and an
 * `OFFSET` deep into a large table both slows down linearly and skips rows when
 * something is published between two pages. A keyset over the primary key does
 * neither.
 */
export interface ContentDeliverySitemapPage {
  entries: ContentSitemapEntry[];
  /** Pass back as `cursor`. `null` when this was the last page. */
  nextCursor: null | number;
}

/**
 * Where a `noIndex` field is stored, resolved to the column it addresses.
 *
 * A leaf path (`seo.noIndex`) compiles to a generated column, and the delivery
 * resolver has already refused a localized one - so this is always a column on the
 * base table and the sitemap predicate is one clause rather than a join.
 */
const noIndexColumn = (
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
): null | PgColumn => {
  const { noIndexField } = definition.delivery.seo;
  if (noIndexField === null) return null;

  const path = splitContentFieldPath(noIndexField);
  if (!path) return columns[noIndexField] ?? null;

  const leaf = definition.advanced.leaves.find(
    entry => entry.path === noIndexField,
  );

  return leaf === undefined ? null : (columns[leaf.columnName] ?? null);
};

/**
 * One page of sitemap entries for one content type, in one language.
 *
 * Everything about this function follows from "a sitemap lists what is public
 * right now, and nothing else":
 *
 * - **The publication predicate is not a parameter.** A nonlocalized entry needs
 *   the base row published; a localized one needs the base row *and* the
 *   translation published, which is the same subordination the public read
 *   applies. A draft, an unpublished record and a future `publishedAt` are all
 *   simply absent.
 * - **No fallback, ever.** Each locale is queried against its own translation, so
 *   a language served English through `fallback: "default"` contributes no URL -
 *   it has none of its own, and listing one would put the same content in the
 *   sitemap twice under two addresses.
 * - **`lastModified` is `max(base.updatedAt, translation.updatedAt)`** for a
 *   localized entry. A shared field moving changes what every language's page
 *   renders even though no translation row was touched, so taking the
 *   translation's timestamp alone would tell a crawler nothing had changed.
 * - **`noIndex` is one clause**, not a post-filter, so a page of 1,000 entries is
 *   1,000 listed URLs rather than however many survived.
 */
export const readContentDeliverySitemapPage = async <
  TDefinition extends AnyContentTypeDefinition,
>({
  args,
  c,
  model,
}: {
  args: ContentDeliverySitemapArgs;
  c: Context;
  model: ContentModel<TDefinition>;
}): Promise<ContentDeliverySitemapPage> => {
  const { columns, definition, translationColumns } = model;
  const { sitemap } = definition.delivery;

  if (!definition.delivery.enabled || !definition.publicApi.enabled) {
    throw new ContentDeliveryNotEnabled({ contentTypeId: definition.id });
  }

  // A content type that lists nothing answers with an empty page rather than
  // throwing: a site-level sitemap index enumerates every delivery-enabled content
  // type, and one of them opting out of the sitemap is a configuration choice, not
  // a caller error.
  if (!sitemap.enabled) return { entries: [], nextCursor: null };

  const limit = Math.max(
    1,
    Math.min(
      args.limit ?? CONTENT_SITEMAP_DEFAULT_PAGE_SIZE,
      CONTENT_SITEMAP_MAX_URLS,
    ),
  );
  const slugField = definition.publicApi.slugField;
  const base = publicationColumns(definition, columns);
  const exclude = noIndexColumn(definition, columns);
  const localized = definition.localization.enabled;
  // Widened, not cast - see `readDeliveryAlternatesMany` for why. The translation
  // table needs the same treatment for the join below.
  const baseTable: PgTableWithColumns<TableConfig> = model.table;
  const joinedTranslations: null | PgTableWithColumns<TableConfig> =
    model.translationTable;

  const conditions: (SQL | undefined)[] = [
    publishedCondition(base),
    args.cursor === undefined ? undefined : gt(columns.id, args.cursor),
    // `IS DISTINCT FROM TRUE`, which is the only spelling that agrees with the
    // metadata. `contentDeliveryRobots` reads `value !== true`, so a `noIndex` of
    // `null` means `index: true` - and the sitemap has to list exactly what claims
    // to be indexable, because "absent from the sitemap" and "robots says index
    // me" is a contradiction a crawler resolves however it likes.
    //
    // `<> TRUE` cannot say it. In SQL `NULL <> TRUE` is `NULL`, not `TRUE`, and a
    // `WHERE` clause drops every row it cannot prove - so a nullable `noIndexField`
    // would quietly empty the sitemap of every record nobody had ever set the flag
    // on, while every one of their pages rendered `index: true`. `IS DISTINCT
    // FROM` is the null-aware comparison: `true` excludes, `false` and `null`
    // include, which is the metadata rule written once more in SQL.
    exclude === null ? undefined : sql`${exclude} is distinct from true`,
  ];

  if (!localized) {
    const rows = await c
      .get("db")
      .select({
        itemId: columns.id,
        lastModified: columns.updatedAt,
        slug: columns[slugField],
      })
      .from(baseTable)
      .where(
        and(...conditions.filter((part): part is SQL => part !== undefined)),
      )
      .orderBy(asc(columns.id))
      .limit(limit + 1);

    return page({
      definition,
      limit,
      locale: null,
      rows: rows.map(row => ({
        itemId: row.itemId as number,
        lastModified: row.lastModified as Date,
        slug: row.slug,
      })),
    });
  }

  if (!joinedTranslations || !translationColumns) {
    return { entries: [], nextCursor: null };
  }

  // Each language is its own sitemap, so the language is resolved before the query
  // rather than joined: a locale that names nothing this install serves has no
  // sitemap, which is an empty page rather than an error - a crawler asking for
  // `/sitemaps/blog.article-de.xml` on a site with no German should get a valid
  // empty document.
  const language = await findContentLanguage(
    c,
    args.locale ?? definition.localization.defaultLocale,
  );
  if (!language?.isEnabled) return { entries: [], nextCursor: null };

  const translation = contentTranslationPublicationColumns(
    definition,
    translationColumns,
  );
  const slugColumn: PgColumn =
    definition.delivery.slugScope === "localized"
      ? translationColumns[slugField]
      : columns[slugField];

  const rows = await c
    .get("db")
    .select({
      itemId: columns.id,
      // The representation's timestamp, not the row's: both halves are rendered
      // into the page, so the later of the two is when it last changed.
      //
      // `.mapWith` is load-bearing rather than tidy. Drizzle turns off the driver's
      // own timestamp parsing so its column mappers can treat a naive `timestamp`
      // as UTC - but a raw `sql` fragment has no mapper, so the driver's fallback
      // parses the same value as *local* time. The two disagree by the server's
      // offset, which would put every localized `lastmod` hours out. Borrowing the
      // column's decoder makes this expression read exactly as the column does.
      lastModified:
        sql<Date>`greatest(${columns.updatedAt}, ${translationColumns.updatedAt})`.mapWith(
          columns.updatedAt,
        ),
      slug: slugColumn,
    })
    .from(baseTable)
    .innerJoin(
      joinedTranslations,
      and(
        eq(translationColumns.itemId, columns.id),
        eq(translationColumns.languageId, language.id),
      ),
    )
    .where(
      and(
        ...conditions.filter((part): part is SQL => part !== undefined),
        publishedCondition(translation),
      ),
    )
    .orderBy(asc(columns.id))
    .limit(limit + 1);

  return page({
    definition,
    limit,
    locale: language.locale,
    rows: rows.map(row => ({
      itemId: row.itemId as number,
      // `greatest()` comes back as a string on some drivers, so it is normalized
      // here rather than trusted - a sitemap `lastmod` of "Invalid Date" is a
      // document a crawler rejects.
      lastModified:
        row.lastModified instanceof Date
          ? row.lastModified
          : new Date(String(row.lastModified)),
      slug: row.slug,
    })),
  });
};

/**
 * Turns one over-fetched page of rows into entries and a cursor.
 *
 * `limit + 1` is fetched and the extra row is dropped, which is how "is there a
 * next page" is answered without a second `COUNT` over a table that may be large.
 */
const page = ({
  definition,
  limit,
  locale,
  rows,
}: {
  definition: AnyContentTypeDefinition;
  limit: number;
  locale: null | string;
  rows: readonly { itemId: number; lastModified: Date; slug: unknown }[];
}): ContentDeliverySitemapPage => {
  const visible = rows.slice(0, limit);
  const { sitemap } = definition.delivery;
  const entries: ContentSitemapEntry[] = [];

  for (const row of visible) {
    const path = contentDeliveryPath({
      definition,
      locale,
      slug: typeof row.slug === "string" ? row.slug : "",
    });
    // A row with no buildable path has no URL, so it has no sitemap line. It stays
    // out of the entries and still advances the cursor, which is why the cursor is
    // taken from `visible` rather than from `entries`.
    if (path === null) continue;

    entries.push({
      changeFrequency: sitemap.changeFrequency,
      itemId: row.itemId,
      lastModified: row.lastModified,
      locale,
      path,
      priority: sitemap.priority,
    });
  }

  return {
    entries,
    nextCursor: rows.length > limit ? (visible.at(-1)?.itemId ?? null) : null,
  };
};
