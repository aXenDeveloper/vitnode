import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, count, eq, inArray, max, sql } from "drizzle-orm";

import type { SitemapEntry, SitemapSource } from "../../lib/seo/sitemap";
import type { ContentDeliveryAlternate } from "../delivery";
import type { ContentId } from "../ids";
import type { ContentPublicUrl } from "../public-url";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel, ContentModel } from "./model";

import { core_files } from "../../database/files";
import { CONFIG } from "../../lib/config";
import { contentDeliveryPublicUrl } from "../delivery";
import { contentIdKey } from "../ids";
import { readDeliveryAlternatesMany } from "./delivery-alternates";
import { contentSitemapConditions } from "./delivery-sitemap";
import { listContentLanguages } from "./language-resolver";
import { contentLocaleRouting } from "./locale-routing";
import { contentDefinitionOf } from "./model";
import {
  contentTranslationPublicationColumns,
  publishedCondition,
} from "./publication";

/** `blog.post` → `blog_post`. Content ids never hold `_`, so this is one-to-one. */
export const contentSitemapSourceId = (contentTypeId: string): string =>
  contentTypeId.replaceAll(".", "_");

/** Whether a registered content type lists its records in the sitemap. */
export const hasContentSitemap = (definition: AnyContentTypeDefinition) =>
  definition.delivery.enabled &&
  definition.publicApi.enabled &&
  definition.delivery.sitemap.enabled;

const href = (url: ContentPublicUrl | { origin?: string; path: string }) => {
  const path = "pathname" in url ? url.pathname : url.path;

  return url.origin === undefined ? path : new URL(path, url.origin).href;
};

const asFileId = (value: unknown): null | number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;

/** Public image URLs by file id. Images are never access-restricted. */
const publicImageUrls = async (
  c: Context,
  fileIds: readonly number[],
): Promise<Map<number, string>> => {
  const unique = [...new Set(fileIds)];
  if (unique.length === 0 || !c.get("core").storage?.adapter) return new Map();

  const rows = await c
    .get("db")
    .select({ id: core_files.id, key: core_files.key })
    .from(core_files)
    .where(
      and(
        inArray(core_files.id, unique),
        eq(core_files.visibility, "public"),
        sql`${core_files.mimeType} like 'image/%'`,
      ),
    );
  const storage = c.get("storage");

  return new Map(
    rows.flatMap((row): [number, string][] => {
      try {
        const url = storage.getUrl(row.key);

        return url ? [[row.id, new URL(url, CONFIG.api.origin).href]] : [];
      } catch {
        // An image is optional in a sitemap; a storage adapter that cannot
        // build its URL drops the image, never the page.
        return [];
      }
    }),
  );
};

interface Row {
  imageId: null | number;
  itemId: ContentId;
  lastModified: Date;
  locale: null | string;
  slug: unknown;
}

const toDate = (value: unknown): Date =>
  value instanceof Date ? value : new Date(String(value));

/**
 * A sitemap source for one content type: every published record a guest may
 * read and that is not `noIndex`, at its current slug. A localized type lists
 * one URL per published translation, each with all its languages as
 * `hreflang` alternates (plus `x-default` when `delivery.hreflang` asks for
 * it). Records are ordered by id, so pages are stable. Server-only.
 */
export const contentSitemapSource = <
  TDefinition extends AnyContentTypeDefinition,
>({
  model,
  pluginId,
}: {
  model: ContentModel<TDefinition>;
  pluginId: string;
}): SitemapSource => {
  const { columns, definition, translationColumns } = model;
  const { sitemap } = definition.delivery;
  const slugField = definition.publicApi.slugField;
  const imageField = definition.delivery.seo.openGraph?.imageField ?? null;
  const imageColumn: null | PgColumn =
    imageField === null ? null : (columns[imageField] ?? null);
  // Widened, not cast - see `readDeliveryAlternatesMany` for why.
  const baseTable: PgTable = model.table;
  const translationTable: null | PgTable = model.translationTable;
  const localized =
    definition.localization.enabled &&
    translationTable !== null &&
    translationColumns !== null;

  const languagesOf = async (c: Context) => {
    const enabled = (await listContentLanguages(c)).filter(
      language => language.isEnabled,
    );

    return new Map(enabled.map(language => [language.id, language.locale]));
  };

  const translationJoin = (languageIds: number[]): SQL =>
    (translationColumns
      ? and(
          eq(translationColumns.itemId, columns.id),
          inArray(translationColumns.languageId, languageIds),
        )
      : undefined) ?? sql`false`;

  const translationPublished = (): (SQL | undefined)[] =>
    translationColumns
      ? [
          publishedCondition(
            contentTranslationPublicationColumns(
              definition,
              translationColumns,
            ),
          ),
        ]
      : [];

  const readRows = async (
    c: Context,
    { limit, offset }: { limit: number; offset: number },
  ): Promise<Row[]> => {
    const conditions = await contentSitemapConditions({ c, model });

    if (!localized || !translationTable || !translationColumns) {
      const rows = await c
        .get("db")
        .select({
          imageId: imageColumn ?? sql<null>`null`,
          itemId: columns.id,
          lastModified: columns.updatedAt,
          slug: columns[slugField],
        })
        .from(baseTable)
        .where(and(...conditions))
        .orderBy(asc(columns.id))
        .limit(limit)
        .offset(offset);

      return rows.map(row => ({
        imageId: asFileId(row.imageId),
        itemId: row.itemId as ContentId,
        lastModified: toDate(row.lastModified),
        locale: null,
        slug: row.slug,
      }));
    }

    const languages = await languagesOf(c);
    if (languages.size === 0) return [];
    const slugColumn: PgColumn =
      definition.delivery.slugScope === "localized"
        ? translationColumns[slugField]
        : columns[slugField];

    const rows = await c
      .get("db")
      .select({
        imageId: imageColumn ?? sql<null>`null`,
        itemId: columns.id,
        languageId: translationColumns.languageId,
        // See `readContentDeliverySitemapPage`: the later of both halves, read
        // with the column's own decoder so it stays in UTC.
        lastModified:
          sql<Date>`greatest(${columns.updatedAt}, ${translationColumns.updatedAt})`.mapWith(
            columns.updatedAt,
          ),
        slug: slugColumn,
      })
      .from(baseTable)
      .innerJoin(translationTable, translationJoin([...languages.keys()]))
      .where(and(...conditions, ...translationPublished()))
      .orderBy(asc(columns.id), asc(translationColumns.languageId))
      .limit(limit)
      .offset(offset);

    return rows.map(row => ({
      imageId: asFileId(row.imageId),
      itemId: row.itemId as ContentId,
      lastModified: toDate(row.lastModified),
      locale: languages.get(Number(row.languageId)) ?? null,
      slug: row.slug,
    }));
  };

  return {
    contentType: { id: definition.id, pluginId },
    count: async c => {
      const conditions = await contentSitemapConditions({ c, model });

      if (!localized || !translationTable || !translationColumns) {
        const [row] = await c
          .get("db")
          .select({ total: count() })
          .from(baseTable)
          .where(and(...conditions));

        return row?.total ?? 0;
      }

      const languages = await languagesOf(c);
      if (languages.size === 0) return 0;
      const [row] = await c
        .get("db")
        .select({ total: count() })
        .from(baseTable)
        .innerJoin(translationTable, translationJoin([...languages.keys()]))
        .where(and(...conditions, ...translationPublished()));

      return row?.total ?? 0;
    },
    getEntries: async (c, page) => {
      const rows = await readRows(c, page);
      const routing = contentLocaleRouting(c);
      const [alternates, images] = await Promise.all([
        localized
          ? readDeliveryAlternatesMany({
              c,
              itemIds: [...new Set(rows.map(row => row.itemId))],
              model,
            })
          : Promise.resolve(new Map<string, ContentDeliveryAlternate[]>()),
        publicImageUrls(
          c,
          rows.flatMap(row => (row.imageId === null ? [] : [row.imageId])),
        ),
      ]);
      const xDefaultLocale =
        definition.delivery.hreflang.xDefault === "defaultLocale"
          ? definition.localization.defaultLocale
          : null;

      return rows.flatMap((row): SitemapEntry[] => {
        if (localized && row.locale === null) return [];
        const url = contentDeliveryPublicUrl({
          definition,
          locale: row.locale,
          routing,
          slug: typeof row.slug === "string" ? row.slug : "",
        });
        if (url === null) return [];

        const languages = alternates.get(contentIdKey(row.itemId)) ?? [];
        const xDefault = languages.find(
          alternate => alternate.locale === xDefaultLocale,
        );
        const image =
          row.imageId === null ? undefined : images.get(row.imageId);

        return [
          {
            changeFrequency: sitemap.changeFrequency,
            lastModified: row.lastModified,
            loc: href(url),
            priority: sitemap.priority,
            ...(languages.length > 1
              ? {
                  alternates: [
                    ...languages.map(alternate => ({
                      href: href(alternate),
                      hreflang: alternate.locale,
                    })),
                    ...(xDefault
                      ? [{ href: href(xDefault), hreflang: "x-default" }]
                      : []),
                  ],
                }
              : {}),
            ...(image ? { images: [{ loc: image }] } : {}),
          },
        ];
      });
    },
    getLastModified: async c => {
      const conditions = await contentSitemapConditions({ c, model });
      const [row] = await c
        .get("db")
        .select({ value: max(columns.updatedAt) })
        .from(baseTable)
        .where(and(...conditions));

      return row?.value ? toDate(row.value) : null;
    },
    id: contentSitemapSourceId(definition.id),
    label: definition.id,
  };
};

/** One source per registered content type with `delivery.sitemap`. Server-only. */
export const contentSitemapSources = (
  models: readonly { model: AnyContentModel; pluginId: string }[],
): SitemapSource[] =>
  models.flatMap(({ model, pluginId }) =>
    hasContentSitemap(contentDefinitionOf(model))
      ? [contentSitemapSource({ model, pluginId })]
      : [],
  );
