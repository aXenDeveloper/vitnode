import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, inArray } from "drizzle-orm";

import type {
  ReactionTargetAccess,
  ReactionTargetDefinition,
  ReactionTargetPreview,
} from "../../lib/reactions/targets";
import type { ContentId } from "../ids";
import type { AnyContentModel } from "./model";
import type { ContentSearchContext } from "./search-document";

import { core_search_index } from "../../database/search";
import { contentI18nKeys } from "../admin/labels";
import { contentIdKey, contentIdsOf, parseContentId } from "../ids";
import { contentSearchContextSource } from "../search";
import { contentDefinitionOf } from "./model";
import { contentUrlOf, reportTitleOf } from "./report-target";
import { toAuthorIds } from "./search-document";
import { contextIdOf, loadContentSearchContexts } from "./search-related";

const PREVIEW_TITLE_LENGTH = 200;

/** The ids among `ids` the visitor can read publicly, as the public API decides it. */
const readableIds = async (
  c: Context,
  model: AnyContentModel,
  ids: ContentId[],
): Promise<Set<string>> => {
  const service = model.publicService?.(c);
  if (!service || ids.length === 0) return new Set();

  if (service.findManyByIds) {
    // Every public read selects `id`.
    const rows = (await service.findManyByIds(ids)) as unknown as {
      id: ContentId;
    }[];

    return new Set(rows.map(row => contentIdKey(row.id)));
  }

  // Localized types have no batch read; a page of reactions is small.
  const found = await Promise.all(
    ids.map(async id => ((await service.findById(id as never)) ? id : null)),
  );

  return new Set(found.flatMap(id => (id === null ? [] : [contentIdKey(id)])));
};

const readAuthors = async (
  c: Context,
  model: AnyContentModel,
  ids: ContentId[],
): Promise<Map<string, null | number>> => {
  const definition = contentDefinitionOf(model);
  const field =
    definition.search.authorField ?? definition.publicWrite.ownerField;
  const columns = model.columns as Record<string, PgColumn>;
  const column = field ? columns[field] : undefined;
  if (!column || ids.length === 0) return new Map();

  const table: PgTable = model.table;
  const rows = await c
    .get("db")
    .select({ id: columns.id, value: column })
    .from(table)
    .where(inArray(columns.id, ids));

  return new Map(
    rows.map(row => [
      contentIdKey(row.id as ContentId),
      toAuthorIds(row.value).at(0) ?? null,
    ]),
  );
};

const cut = (value: string): string => {
  const text = value.replace(/\s+/g, " ").trim();

  return text.length > PREVIEW_TITLE_LENGTH
    ? `${text.slice(0, PREVIEW_TITLE_LENGTH - 1).trimEnd()}…`
    : text;
};

/** Title and link of records that are not in the search index, from their own row. */
const recordPreviews = async (
  c: Context,
  model: AnyContentModel,
  ids: string[],
  label: string,
): Promise<Map<string, ReactionTargetPreview>> => {
  const result = new Map<string, ReactionTargetPreview>();
  const definition = contentDefinitionOf(model);
  const columns = model.columns as Record<string, PgColumn>;
  const slugColumn = definition.publicApi.enabled
    ? columns[definition.publicApi.slugField]
    : undefined;
  const titleField =
    definition.reports.titleField ?? definition.admin.titleField;
  const titleColumn = titleField ? columns[titleField] : undefined;
  const source = contentSearchContextSource(definition);
  const contextColumn = source ? columns[source.field] : undefined;
  const parsed = contentIdsOf(definition.idStrategy, ids);
  if (!slugColumn || parsed.length === 0) return result;

  const table: PgTable = model.table;
  const rows = await c
    .get("db")
    .select({
      id: columns.id,
      slug: slugColumn,
      ...(titleColumn ? { title: titleColumn } : {}),
      ...(contextColumn ? { context: contextColumn } : {}),
    })
    .from(table)
    .where(inArray(columns.id, parsed));
  const contexts =
    source && contextColumn
      ? await loadContentSearchContexts(
          c,
          definition,
          rows.map(row => ({
            [source.field]: "context" in row ? row.context : null,
          })),
        )
      : new Map<string, ContentSearchContext>();
  const contextOfRow = (
    row: (typeof rows)[number],
  ): ReactionTargetPreview["context"] => {
    if (!source || !("context" in row)) return undefined;
    const contextId = contextIdOf(source, row.context);
    const context =
      contextId === null ? undefined : contexts.get(contentIdKey(contextId));

    return context?.isPublic
      ? { title: cut(context.title), url: context.url }
      : undefined;
  };

  for (const row of rows) {
    const url = contentUrlOf(c, definition, { locale: null, slug: row.slug });
    if (!url) continue;
    const title =
      reportTitleOf("title" in row ? row.title : null) ??
      (typeof row.slug === "string" ? row.slug : "");
    const context = contextOfRow(row);
    result.set(contentIdKey(row.id as ContentId), {
      ...(context ? { context } : {}),
      label,
      title: cut(title),
      url,
    });
  }

  return result;
};

const contextOf = (
  metadata: Record<string, unknown>,
): ReactionTargetPreview["context"] => {
  const { context } = metadata;
  if (typeof context !== "object" || context === null) return undefined;
  const { title, url } = context as Record<string, unknown>;
  if (typeof title !== "string" || title === "") return undefined;

  return { title: cut(title), url: typeof url === "string" ? url : null };
};

const searchPreviews = async (
  c: Context,
  itemType: string,
  ids: string[],
  label: string,
): Promise<Map<string, ReactionTargetPreview>> => {
  const result = new Map<string, ReactionTargetPreview>();
  const rows = await c
    .get("db")
    .select({
      itemId: core_search_index.itemId,
      languageCode: core_search_index.languageCode,
      metadata: core_search_index.metadata,
      title: core_search_index.title,
      url: core_search_index.url,
    })
    .from(core_search_index)
    .where(
      and(
        eq(core_search_index.itemType, itemType),
        inArray(core_search_index.itemId, ids),
      ),
    );
  const language = c.get("user")?.language ?? "";

  for (const id of ids) {
    const own = rows.filter(row => row.itemId === id && row.url);
    const row =
      own.find(item => item.languageCode === language) ??
      own.find(item => item.languageCode === "") ??
      own[0];
    if (!row?.url) continue;

    const context = contextOf(row.metadata);
    result.set(id, {
      ...(context ? { context } : {}),
      label,
      title: cut(row.title),
      url: row.url,
    });
  }

  return result;
};

/**
 * The reaction target of a content type with `reactions`: a member may react
 * to what the public API would show them, and the record's author (the search
 * author field, or the public write owner) collects the reputation.
 */
export const contentReactionTarget = (
  model: AnyContentModel,
  pluginId: string,
): ReactionTargetDefinition => {
  const definition = contentDefinitionOf(model);

  return {
    access: async (c, { ids }) => {
      const parsed = contentIdsOf(definition.idStrategy, ids);
      const [readable, authors] = await Promise.all([
        readableIds(c, model, parsed),
        readAuthors(c, model, parsed),
      ]);

      const result = new Map<string, ReactionTargetAccess>();
      for (const id of parsed) {
        const key = contentIdKey(id);
        if (!readable.has(key)) continue;
        result.set(key, { authorId: authors.get(key) ?? null, canRead: true });
      }

      return result;
    },
    parseId: value => {
      const id = parseContentId(definition.idStrategy, value);

      return id === null ? null : contentIdKey(id);
    },
    preview: async (c, { ids }) => {
      if (ids.length === 0) return new Map();
      const label = contentI18nKeys(definition, pluginId).label;
      const result = definition.search.enabled
        ? await searchPreviews(c, definition.id, ids, label)
        : new Map<string, ReactionTargetPreview>();

      const missing = ids.filter(id => !result.has(id));
      for (const [id, preview] of await recordPreviews(
        c,
        model,
        missing,
        label,
      )) {
        result.set(id, preview);
      }

      return result;
    },
    reputation: definition.reactions.reputation,
    type: definition.id,
  };
};
