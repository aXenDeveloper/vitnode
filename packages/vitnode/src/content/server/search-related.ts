import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import type { ContentLocaleRouting } from "../public-url";
import type { ContentSearchContextSource } from "../search";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentSearchContext } from "./search-document";

import { core_content_containers } from "../../database/content-containers";
import { contentIdKey, parseContentId } from "../ids";
import {
  contentSearchContextSource,
  contentSearchTemplateUrl,
  contentSearchUrl,
} from "../search";
import { listContentLanguages } from "./language-resolver";
import { contentLocaleRouting } from "./locale-routing";
import { findContentModel } from "./model";
import { isContentRowPublic } from "./search-document";

const RELATED_PUBLICATION_COLUMNS = ["status", "publishedAt", "hiddenAt"];

const contextIdOf = (
  source: ContentSearchContextSource,
  value: unknown,
): null | number | string => {
  if (source.kind === "container") {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
  }

  return parseContentId(source.target.idStrategy, value);
};

export const contentSearchContextKey = (
  definition: AnyContentTypeDefinition,
  row: object,
): null | string => {
  const source = contentSearchContextSource(definition);
  if (!source) return null;

  const id = contextIdOf(
    source,
    (row as Record<string, unknown>)[source.field],
  );

  return id === null ? null : contentIdKey(id);
};

export const toRelatedSearchContext = (
  target: AnyContentTypeDefinition,
  row: object,
  routing: ContentLocaleRouting,
  locale?: string,
): ContentSearchContext => {
  const values = row as Record<string, unknown>;
  const title = values[target.search.titleField];
  const slug = values[target.publicApi.slugField];

  return {
    containerId:
      typeof values.id === "number" && Number.isSafeInteger(values.id)
        ? values.id
        : null,
    containerType: target.id,
    isPublic: isContentRowPublic(values),
    title: typeof title === "string" ? title : "",
    url:
      typeof slug === "string"
        ? contentSearchUrl({ definition: target, locale, routing, slug })
        : null,
  };
};

export const toContainerSearchContext = (
  source: Extract<ContentSearchContextSource, { kind: "container" }>,
  container: { id: number; name: string; slug: string },
  routing: ContentLocaleRouting,
): ContentSearchContext => ({
  containerId: container.id,
  containerType: source.containerType,
  isPublic: true,
  title: container.name,
  url: contentSearchTemplateUrl({
    pathTemplate: source.pathTemplate,
    routing,
    slug: container.slug,
  }),
});

interface RelatedTranslation {
  locale: string;
  values: Record<string, unknown>;
}

const loadRelatedTranslations = async (
  c: Context,
  {
    columns,
    defaultLocale,
    ids,
    names,
    table,
  }: {
    columns: Record<string, PgColumn | undefined>;
    defaultLocale: string;
    ids: readonly (number | string)[];
    names: string[];
    table: PgTable;
  },
): Promise<Map<string, RelatedTranslation>> => {
  const itemIdColumn = columns.itemId;
  const languageIdColumn = columns.languageId;
  if (!itemIdColumn || !languageIdColumn || names.length === 0) {
    return new Map();
  }

  const selection: Record<string, PgColumn> = {
    itemId: itemIdColumn,
    languageId: languageIdColumn,
  };
  for (const name of names) {
    const column = columns[name];
    if (column) selection[name] = column;
  }

  const [rows, languages] = await Promise.all([
    c
      .get("db")
      .select(selection)
      .from(table)
      .where(inArray(itemIdColumn, [...ids])),
    listContentLanguages(c),
  ]);
  const localeOf = new Map(
    languages.map(language => [language.id, language.locale]),
  );

  const picked = new Map<string, RelatedTranslation>();
  for (const row of rows) {
    const locale = localeOf.get(row.languageId as number);
    if (locale === undefined) continue;

    const key = contentIdKey(row.itemId as number | string);
    const current = picked.get(key);
    if (current && current.locale === defaultLocale) continue;
    if (!current || locale === defaultLocale) {
      picked.set(key, { locale, values: row });
    }
  }

  return picked;
};

const loadRelatedContexts = async (
  c: Context,
  target: AnyContentTypeDefinition,
  ids: readonly (number | string)[],
): Promise<[string, ContentSearchContext][]> => {
  if (!target.search.enabled || ids.length === 0) return [];

  const targetModel = findContentModel(
    c.get("core")?.contentModels ?? [],
    target.id,
  )?.model;
  if (!targetModel) return [];

  const columns = targetModel.columns as Record<string, PgColumn | undefined>;
  const translationColumns = targetModel.translationColumns as null | Record<
    string,
    PgColumn | undefined
  >;
  const { titleField } = target.search;
  const { slugField } = target.publicApi;
  const idColumn = columns.id;
  const translated = [titleField, slugField].filter(
    name => !columns[name] && translationColumns?.[name],
  );
  if (!idColumn || (!columns[titleField] && !translated.includes(titleField))) {
    return [];
  }

  const selection: Record<string, PgColumn> = { id: idColumn };
  for (const name of [titleField, slugField, ...RELATED_PUBLICATION_COLUMNS]) {
    const column = columns[name];
    if (column) selection[name] = column;
  }

  const [rows, translations] = await Promise.all([
    c
      .get("db")
      .select(selection)
      .from(targetModel.table)
      .where(inArray(idColumn, [...ids])),
    translationColumns && targetModel.translationTable
      ? loadRelatedTranslations(c, {
          columns: translationColumns,
          defaultLocale: target.localization.defaultLocale,
          ids,
          names: translated,
          table: targetModel.translationTable,
        })
      : new Map<string, RelatedTranslation>(),
  ]);
  const routing = contentLocaleRouting(c);

  return rows.flatMap(row => {
    const id = parseContentId(target.idStrategy, row.id);
    if (id === null) return [];

    const key = contentIdKey(id);
    const translation = translations.get(key);

    return [
      [
        key,
        toRelatedSearchContext(
          target,
          translation ? { ...row, ...translation.values } : row,
          routing,
          translation?.locale,
        ),
      ],
    ];
  });
};

export const loadRelatedSearchContext = async (
  c: Context,
  target: AnyContentTypeDefinition,
  id: number | string,
): Promise<ContentSearchContext | undefined> =>
  new Map(await loadRelatedContexts(c, target, [id])).get(contentIdKey(id));

const loadContainerContexts = async (
  c: Context,
  source: Extract<ContentSearchContextSource, { kind: "container" }>,
  ids: readonly (number | string)[],
): Promise<[string, ContentSearchContext][]> => {
  const numeric = ids.filter((id): id is number => typeof id === "number");
  if (numeric.length === 0) return [];

  const rows = await c
    .get("db")
    .select({
      id: core_content_containers.id,
      name: core_content_containers.name,
      slug: core_content_containers.slug,
    })
    .from(core_content_containers)
    .where(
      and(
        eq(core_content_containers.definitionId, source.containerType),
        inArray(core_content_containers.id, numeric),
      ),
    );
  const routing = contentLocaleRouting(c);

  return rows.map(row => [
    contentIdKey(row.id),
    toContainerSearchContext(source, row, routing),
  ]);
};

export const loadContentSearchContexts = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  rows: readonly object[],
): Promise<Map<string, ContentSearchContext>> => {
  const source = contentSearchContextSource(definition);
  if (!source) return new Map();

  const ids = new Map<string, number | string>();
  for (const row of rows) {
    const id = contextIdOf(
      source,
      (row as Record<string, unknown>)[source.field],
    );
    if (id !== null) ids.set(contentIdKey(id), id);
  }
  if (ids.size === 0) return new Map();

  return new Map(
    source.kind === "relation"
      ? await loadRelatedContexts(c, source.target, [...ids.values()])
      : await loadContainerContexts(c, source, [...ids.values()]),
  );
};
