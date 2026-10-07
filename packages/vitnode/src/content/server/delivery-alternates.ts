import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, eq, inArray } from "drizzle-orm";

import type { ContentDeliveryAlternate } from "../delivery";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";
import type { ContentDatabase } from "./service";

import {
  contentDeliveryInternalPath,
  contentDeliveryPublicUrl,
} from "../delivery";
import { contentIdKey, parseContentId } from "../ids";
import { listContentLanguages } from "./language-resolver";
import { contentLocaleRouting } from "./locale-routing";
import {
  contentTranslationPublicationColumns,
  publicationColumns,
  publishedCondition,
} from "./publication";

export const readDeliveryAlternates = async <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  itemId,
  model,
}: {
  c: Context;
  itemId: ContentId;
  model: ContentModel<TDefinition>;
}): Promise<ContentDeliveryAlternate[]> => {
  const batched = await readDeliveryAlternatesMany({
    c,
    itemIds: [itemId],
    model,
  });

  return batched.get(contentIdKey(itemId)) ?? [];
};

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
  itemIds: readonly ContentId[];
  model: ContentModel<TDefinition>;
}): Promise<Map<string, ContentDeliveryAlternate[]>> => {
  const { columns, definition, translationColumns, translationTable } = model;
  // Keyed by `contentIdKey`, so a caller's id and the driver's meet whatever the
  // strategy - and a bigint is never rounded on the way.
  const grouped = new Map<string, ContentDeliveryAlternate[]>();

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

  const routing = contentLocaleRouting(c);
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
    const itemId = parseContentId(definition.idStrategy, row.itemId);
    const languageId =
      typeof row.languageId === "number" ? row.languageId : null;
    if (itemId === null || languageId === null) continue;

    const language = byId.get(languageId);
    if (!language?.isEnabled) continue;

    const slug = typeof row.slug === "string" ? row.slug : "";
    const internalPath = contentDeliveryInternalPath({ definition, slug });
    const url = contentDeliveryPublicUrl({
      definition,
      locale: language.locale,
      routing,
      slug,
    });
    if (url === null || internalPath === null) continue;

    const itemKey = contentIdKey(itemId);
    const entries = grouped.get(itemKey) ?? [];
    entries.push({
      internalPath,
      locale: language.locale,
      ...(url.origin === undefined ? {} : { origin: url.origin }),
      path: url.pathname,
    });
    grouped.set(itemKey, entries);
  }

  for (const entries of grouped.values()) {
    entries.sort((a, b) => a.locale.localeCompare(b.locale));
  }

  return grouped;
};
