import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, eq, inArray } from "drizzle-orm";

import type { ContentDeliveryAlternate } from "../delivery";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";
import type { ContentDatabase } from "./service";

import { contentDeliveryPath } from "../delivery";
import { listContentLanguages } from "./language-resolver";
import {
  contentTranslationPublicationColumns,
  publicationColumns,
  publishedCondition,
} from "./publication";

/**
 * The localized alternates of one record: every language it is genuinely
 * published in, and its URL there.
 *
 * "Genuinely" is the whole of it, and it is why this is a query rather than a
 * projection of something the public read already returned. An alternate is a
 * promise that a URL resolves, so the predicate is the *same* subordinated
 * publication rule the public read applies - the base row published, the
 * translation published, both dated now or earlier - and a locale that only exists
 * through `fallback: "default"` fails it. Fabricating an alternate from a fallback
 * would announce `/de/articles/x` for a record with no German translation: an
 * `hreflang` pointing at a 404, and an invitation to index the English copy twice.
 *
 * A language the installation has switched off is filtered out too, in JavaScript
 * rather than in SQL - "enabled" is a fact about the app config, not a column on
 * `core_languages`, and `listContentLanguages` already holds it for the life of the
 * request.
 */
export const readDeliveryAlternates = async <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  itemId,
  model,
}: {
  c: Context;
  itemId: number;
  model: ContentModel<TDefinition>;
}): Promise<ContentDeliveryAlternate[]> => {
  const batched = await readDeliveryAlternatesMany({
    c,
    itemIds: [itemId],
    model,
  });

  return batched.get(itemId) ?? [];
};

/**
 * The same answer for a whole page of records, in one query.
 *
 * A sitemap with `xhtml:link` alternates needs the alternates of every URL on the
 * page, and a per-record query there is the classic N+1 that only becomes visible
 * once a site has content. One `IN` and one grouping pass instead.
 */
export const readDeliveryAlternatesMany = async <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  database,
  itemIds,
  model,
}: {
  c: Context;
  database?: ContentDatabase;
  itemIds: readonly number[];
  model: ContentModel<TDefinition>;
}): Promise<Map<number, ContentDeliveryAlternate[]>> => {
  const { columns, definition, translationColumns, translationTable } = model;
  const grouped = new Map<number, ContentDeliveryAlternate[]>();

  if (
    itemIds.length === 0 ||
    !definition.localization.enabled ||
    !definition.publicApi.enabled ||
    !translationTable ||
    !translationColumns
  ) {
    return grouped;
  }

  const slugField = definition.publicApi.slugField;
  const base = publicationColumns(definition, columns);
  const translation = contentTranslationPublicationColumns(
    definition,
    translationColumns,
  );

  // The slug comes off whichever table owns it. A shared slug gives every language
  // the same segment, which is a legitimate shape - the locale prefix is what makes
  // the two URLs different - so it is read from the base row for all of them.
  const slugColumn: PgColumn =
    definition.delivery.slugScope === "localized"
      ? translationColumns[slugField]
      : columns[slugField];

  const languages = await listContentLanguages(c);
  const byId = new Map(languages.map(language => [language.id, language]));
  // Widened, not cast: the generated table type carries every column as a literal,
  // which Drizzle's `.from()` and `.innerJoin()` overloads cannot resolve through a
  // generic. The same widening `buildContentPublicRoutes` documents.
  const baseTable: PgTableWithColumns<TableConfig> = model.table;

  const rows = await (database ?? c.get("db"))
    .select({
      itemId: translationColumns.itemId,
      languageId: translationColumns.languageId,
      slug: slugColumn,
    })
    .from(translationTable as PgTable)
    .innerJoin(baseTable, eq(translationColumns.itemId, columns.id))
    .where(
      and(
        inArray(translationColumns.itemId, [...itemIds]),
        publishedCondition(base),
        publishedCondition(translation),
      ),
    )
    // Deterministic: two processes rendering the same `hreflang` set - or the same
    // sitemap - produce the same document, which is what makes a byte comparison a
    // usable test rather than a flake. Sorted again by locale below, because the
    // canonical code is resolved in JavaScript.
    .orderBy(
      asc(translationColumns.itemId),
      asc(translationColumns.languageId),
    );

  for (const row of rows) {
    // The selected keys come back as `unknown` through the generic column map, so
    // each one is narrowed here rather than asserted - the same treatment the
    // sitemap query gives its own projection.
    const itemId = typeof row.itemId === "number" ? row.itemId : null;
    const languageId =
      typeof row.languageId === "number" ? row.languageId : null;
    if (itemId === null || languageId === null) continue;

    const language = byId.get(languageId);
    if (!language?.isEnabled) continue;

    const path = contentDeliveryPath({
      definition,
      locale: language.locale,
      slug: typeof row.slug === "string" ? row.slug : "",
    });
    if (path === null) continue;

    const entries = grouped.get(itemId) ?? [];
    entries.push({ locale: language.locale, path });
    grouped.set(itemId, entries);
  }

  for (const entries of grouped.values()) {
    entries.sort((a, b) => a.locale.localeCompare(b.locale));
  }

  return grouped;
};
