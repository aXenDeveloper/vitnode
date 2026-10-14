import type { PgColumn } from "drizzle-orm/pg-core";
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
        ? contentSearchUrl({ definition: target, routing, slug })
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

const loadRelatedContexts = async (
  c: Context,
  source: Extract<ContentSearchContextSource, { kind: "relation" }>,
  ids: readonly (number | string)[],
): Promise<[string, ContentSearchContext][]> => {
  const { target } = source;
  if (!target.search.enabled) return [];

  const targetModel = findContentModel(
    c.get("core")?.contentModels ?? [],
    target.id,
  )?.model;
  if (!targetModel) return [];

  const columns = targetModel.columns as Record<string, PgColumn | undefined>;
  const idColumn = columns.id;
  const titleColumn = columns[target.search.titleField];
  const slugColumn = columns[target.publicApi.slugField];
  if (!idColumn || !titleColumn) return [];

  const selection: Record<string, PgColumn> = {
    id: idColumn,
    [target.search.titleField]: titleColumn,
    ...(slugColumn ? { [target.publicApi.slugField]: slugColumn } : {}),
  };
  for (const name of RELATED_PUBLICATION_COLUMNS) {
    const column = columns[name];
    if (column) selection[name] = column;
  }

  const rows = await c
    .get("db")
    .select(selection)
    .from(targetModel.table)
    .where(inArray(idColumn, [...ids]));
  const routing = contentLocaleRouting(c);

  return rows.flatMap(row => {
    const id = parseContentId(target.idStrategy, row.id);

    return id === null
      ? []
      : [[contentIdKey(id), toRelatedSearchContext(target, row, routing)]];
  });
};

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
      ? await loadRelatedContexts(c, source, [...ids.values()])
      : await loadContainerContexts(c, source, [...ids.values()]),
  );
};
