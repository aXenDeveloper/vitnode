import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { ContentPublicLocaleState } from "../cache";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { isContentPubliclyVisible } from "../cache";
import { contentLocalesMatch } from "../locale";
import { partitionContentFields } from "../localization";
import { listContentLanguages } from "./language-resolver";

export type { ContentPublicLocaleState };

type PublicationRow = Record<string, unknown> | undefined;

const isVisible = (row: PublicationRow): boolean =>
  row !== undefined &&
  isContentPubliclyVisible({
    publishedAt: row.publishedAt as Date | null | string | undefined,
    status: typeof row.status === "string" ? row.status : undefined,
  });

/** A column value as the slug it is, or `""`. A slug column is always text. */
const asSlug = (value: unknown): string =>
  typeof value === "string" ? value : "";

export const contentPublicLocaleStates = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  model: ContentModel<TDefinition>,
  itemId: number,
  { row }: { row?: Record<string, unknown> } = {},
): Promise<ContentPublicLocaleState[]> => {
  const { definition } = model;
  const { localization, publicApi } = definition;

  if (!localization.enabled || !publicApi.enabled) return [];

  const translationColumns: null | Record<string, PgColumn> =
    model.translationColumns;
  const translationTable: null | PgTable = model.translationTable;
  if (!translationColumns || !translationTable) return [];

  const columns = model.columns as Record<string, PgColumn>;
  // Widened, not asserted: the generated table type carries every column as a
  // literal, which Drizzle's `.from()` overloads cannot resolve through a generic.
  const table: PgTable = model.table;
  const slugField = publicApi.slugField;
  const { localizedFields } = partitionContentFields(definition.fields);
  const slugIsLocalized = localizedFields[slugField] !== undefined;

  const base =
    row ??
    (
      await c
        .get("db")
        .select({
          publishedAt: columns.publishedAt,
          status: columns.status,
          ...(slugIsLocalized ? {} : { [slugField]: columns[slugField] }),
        })
        .from(table)
        .where(eq(columns.id, itemId))
        .limit(1)
    )[0];

  if (!base) return [];

  const baseRow: Record<string, unknown> = base;
  const basePublic = isVisible(baseRow);
  const sharedSlug = slugIsLocalized ? "" : asSlug(baseRow[slugField]);

  const rows = await c
    .get("db")
    .select({
      languageId: translationColumns.languageId,
      publishedAt: translationColumns.publishedAt,
      status: translationColumns.status,
      ...(slugIsLocalized
        ? { [slugField]: translationColumns[slugField] }
        : {}),
    })
    .from(translationTable)
    .where(eq(translationColumns.itemId, itemId));

  const byLanguage = new Map(
    rows.map(entry => [entry.languageId as number, entry]),
  );

  const languages = (await listContentLanguages(c)).filter(
    language => language.isEnabled,
  );
  const defaultLanguage = languages.find(language =>
    contentLocalesMatch(language.locale, localization.defaultLocale),
  );
  const defaultTranslation =
    defaultLanguage === undefined
      ? undefined
      : byLanguage.get(defaultLanguage.id);
  const defaultIsPublic = basePublic && isVisible(defaultTranslation);

  const slugOf = (translation: PublicationRow): string =>
    slugIsLocalized ? asSlug(translation?.[slugField]) : sharedSlug;

  return languages.map(language => {
    const own = byLanguage.get(language.id);
    const ownIsPublic = basePublic && isVisible(own);

    if (ownIsPublic) {
      return {
        hasOwnTranslation: true,
        isPublic: true,
        locale: language.locale,
        slug: slugOf(own),
      };
    }

    // Not its own, so this locale is whatever the fallback says it is. The
    // fallback's slug travels with it: a fallback page answers to the default
    // translation's URL, under this locale's tag.
    if (localization.fallback === "default" && defaultIsPublic) {
      return {
        hasOwnTranslation: false,
        isPublic: true,
        locale: language.locale,
        slug: slugOf(defaultTranslation),
      };
    }

    return {
      hasOwnTranslation: false,
      isPublic: false,
      locale: language.locale,
      // The URL it *used* to answer to, when there is a row to read one off.
      // Reported even though it is not public, because the caller compares two
      // snapshots and this is the side that has to expire a withdrawn page.
      slug: slugOf(own),
    };
  });
};
