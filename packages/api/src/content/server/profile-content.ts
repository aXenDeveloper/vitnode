import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, count, eq, exists, inArray, sql } from "drizzle-orm";

import type {
  SearchDocument,
  SearchHitAuthor,
  SearchHitImage,
} from "../../models/search";
import type { ContentAccessActor } from "../access/policy";
import type { ContentId } from "../ids";
import type { ContentProfileType } from "../registry";
import type { AnyContentModel, RegisteredContentModel } from "./model";

import { stripHtml } from "../../lib/strip-html";
import { contentAccessCondition } from "../access/server/source";
import { contentIdKey, parseContentId } from "../ids";
import { contentProfileTypes } from "../registry";
import { listContentLanguages } from "./language-resolver";
import { contentDefinitionOf } from "./model";
import { contentParentVisibleCondition } from "./parent-visibility";
import {
  contentTranslationPublicationColumns,
  publicationColumns,
  publishedCondition,
} from "./publication";
import { loadContentSearchDocumentsByIds } from "./search-indexer";

/** Counts and lists are what a signed-out visitor sees, whoever asks. */
const GUEST: ContentAccessActor = { kind: "guest" };

/** Plain-text characters a card keeps of the body. */
const CONTENT_PROFILE_SNIPPET_LENGTH = 320;

interface ProfileSource {
  model: AnyContentModel;
  type: ContentProfileType;
}

const sourcesByCore = new WeakMap<object, ProfileSource[]>();

const profileSourcesOf = (c: Context): ProfileSource[] => {
  const core = c.get("core") as
    | undefined
    | { contentModels?: RegisteredContentModel[] };
  const models = core?.contentModels ?? [];
  const cached = core ? sourcesByCore.get(core) : undefined;
  if (cached) return cached;

  const types = contentProfileTypes(
    models.map(entry => ({
      definition: contentDefinitionOf(entry.model),
      pluginId: entry.pluginId,
    })),
  );
  const sources = types.flatMap(type => {
    const model = models.find(
      entry => entry.model.definition.id === type.id,
    )?.model;

    return model ? [{ model, type }] : [];
  });
  if (core) sourcesByCore.set(core, sources);

  return sources;
};

/**
 * The content types members' profiles list in this app: `profileContent`
 * types of installed plugins, sorted by id. The only valid values of the
 * Content filter. Server-only.
 */
export const listContentProfileTypes = (c: Context): ContentProfileType[] =>
  profileSourcesOf(c).map(source => source.type);

/**
 * The `WHERE` condition for "a record this member is credited for that a
 * guest may read": published (not drafted, scheduled, hidden or deleted),
 * readable by a guest through its own and its parents' access rules, under a
 * published parent and, when localized, with at least one published
 * translation in an enabled language. One condition for the count and the
 * list, so the two never disagree.
 */
const profileCondition = async (
  c: Context,
  { model }: ProfileSource,
  userId: number,
  enabledLanguageIds: readonly number[],
): Promise<SQL | undefined> => {
  const definition = contentDefinitionOf(model);
  const columns = model.columns as Record<string, PgColumn>;
  const authorField = definition.profileContent.authorField;
  if (!authorField) return sql`false`;

  const junction = model.advancedTables.junctions[authorField] as
    | (typeof model.advancedTables.junctions)[string]
    | undefined;
  const authorColumn = columns[authorField];
  const author = junction
    ? exists(
        c
          .get("db")
          .select({ one: sql`1` })
          .from(junction)
          .where(
            and(
              eq(junction.itemId, columns.id),
              eq(junction.relatedItemId, userId),
            ),
          ),
      )
    : authorColumn
      ? eq(authorColumn, userId)
      : sql`false`;

  const translationTable: null | PgTable = model.translationTable;
  const translationColumns = model.translationColumns as null | Record<
    string,
    PgColumn
  >;
  const translated =
    definition.localization.enabled && translationTable && translationColumns
      ? enabledLanguageIds.length === 0
        ? sql`false`
        : exists(
            c
              .get("db")
              .select({ one: sql`1` })
              .from(translationTable)
              .where(
                and(
                  eq(translationColumns.itemId, columns.id),
                  inArray(translationColumns.languageId, [
                    ...enabledLanguageIds,
                  ]),
                  publishedCondition(
                    contentTranslationPublicationColumns(
                      definition,
                      translationColumns,
                    ),
                  ),
                ),
              ),
          )
      : undefined;

  return and(
    author,
    publishedCondition(publicationColumns(definition, columns)),
    await contentAccessCondition(c, model, "read", GUEST),
    contentParentVisibleCondition(c, definition, columns),
    translated,
  );
};

const enabledLanguageIdsOf = async (
  c: Context,
  sources: readonly ProfileSource[],
): Promise<number[]> =>
  sources.some(({ model }) => contentDefinitionOf(model).localization.enabled)
    ? (await listContentLanguages(c))
        .filter(language => language.isEnabled)
        .map(language => language.id)
    : [];

/** How many records a member is credited for, per listed content type. */
export interface ContentProfileStats {
  /** Every listed type, `0` included. */
  byType: Record<string, number>;
  /** The sum of `byType`. */
  total: number;
}

/**
 * Counts what a member authored, as a guest would see it: once per record
 * (a translated article is one), per listed content type, plus the total.
 * Read from the content tables on every call - no counter, no index - so a
 * publish, hide, restore, delete or author change shows on the next read.
 * Server-only.
 */
export const countContentProfile = async (
  c: Context,
  { userId }: { userId: number },
): Promise<ContentProfileStats> => {
  const sources = profileSourcesOf(c);
  const languages = await enabledLanguageIdsOf(c, sources);

  const counts = await Promise.all(
    sources.map(async source => {
      const columns = source.model.columns as Record<string, PgColumn>;
      const table: PgTable = source.model.table;
      const [row] = await c
        .get("db")
        .select({ value: count(columns.id) })
        .from(table)
        .where(await profileCondition(c, source, userId, languages));

      return [source.type.id, row?.value ?? 0] as const;
    }),
  );

  const byType = Object.fromEntries(counts);

  return {
    byType,
    total: counts.reduce((sum, [, value]) => sum + value, 0),
  };
};

/**
 * Where a Content page ends: the record's publication time (as Postgres
 * prints it, to the microsecond), its type and its id key. Publication time
 * never changes once set, so an edit or a language switch cannot move an
 * item between pages.
 */
export interface ContentProfileCursorKey {
  at: string;
  id: string;
  type: string;
}

/** One authored record, as a profile's Content tab renders it. */
export interface ContentProfileCard {
  /** Every credited author's public summary, in credit order. */
  authors: SearchHitAuthor[];
  /** Plain text, cut to a snippet. */
  content: string;
  /** The record's publication time - what the page is sorted by. */
  createdAt: Date;
  image: null | SearchHitImage;
  itemId: ContentId;
  itemType: string;
  languageCode: string;
  metadata: Record<string, unknown>;
  pluginId: string;
  title: string;
  url: null | string;
}

type ContentProfileDraft = Omit<ContentProfileCard, "authors" | "image"> & {
  authorIds: number[];
  imageId: null | number;
};

/** An id key that sorts like the id: zero-padded numbers, uuids as they are. */
const idKeyExpression = (model: AnyContentModel, column: PgColumn): SQL =>
  contentDefinitionOf(model).idStrategy === "uuid"
    ? sql`${column}::text`
    : sql`lpad(${column}::text, 20, '0')`;

/** `(at, type, id) < cursor`, with the type constant per branch. */
const afterCursor = (
  source: ProfileSource,
  at: PgColumn,
  idKey: SQL,
  cursor: ContentProfileCursorKey | undefined,
): SQL | undefined => {
  if (!cursor) return undefined;
  const when = sql`${cursor.at}::timestamp`;

  if (source.type.id < cursor.type) return sql`${at} <= ${when}`;
  if (source.type.id > cursor.type) return sql`${at} < ${when}`;

  return sql`(${at}, ${idKey} collate "C") < (${when}, ${cursor.id} collate "C")`;
};

const AT_FORMAT = `YYYY-MM-DD"T"HH24:MI:SS.US`;

const toDraft = (
  document: SearchDocument,
  pluginId: string,
): ContentProfileDraft => {
  const body = stripHtml(document.content).replace(/\s+/g, " ").trim();
  // A type that indexes its title as content too would open with it twice.
  const text = body.startsWith(`${document.title} `)
    ? body.slice(document.title.length).trimStart()
    : body;

  return {
    authorIds: [...new Set(document.authorIds ?? [])],
    content:
      text.length > CONTENT_PROFILE_SNIPPET_LENGTH
        ? `${text.slice(0, CONTENT_PROFILE_SNIPPET_LENGTH).trimEnd()}…`
        : text,
    createdAt: document.createdAt,
    imageId: document.imageId ?? null,
    itemId: document.itemId,
    itemType: document.itemType,
    languageCode: document.languageCode ?? "",
    metadata: document.metadata ?? {},
    pluginId: document.pluginId ?? pluginId,
    title: document.title,
    url: document.url ?? null,
  };
};

/**
 * One page of what a member authored, newest first, as a guest sees it -
 * the same records {@link countContentProfile} counts. `type` narrows it to
 * one listed content type before the page is cut.
 *
 * Two steps: the page's identities and sort keys from one `UNION ALL` of
 * per-type candidates (each already ordered and limited, so only `first + 1`
 * rows per type are read), then the card fields in one batch per type. A
 * localized record is shown in `locale` when it is published there, else in
 * its fallback or another published language. Server-only.
 */
export const readContentProfilePage = async (
  c: Context,
  {
    after,
    first,
    locale,
    type,
    userId,
  }: {
    after?: ContentProfileCursorKey;
    first: number;
    locale?: string;
    type?: string;
    userId: number;
  },
): Promise<{
  cards: ContentProfileCard[];
  endCursor: ContentProfileCursorKey | null;
  hasNextPage: boolean;
}> => {
  const sources = profileSourcesOf(c).filter(
    source => type === undefined || source.type.id === type,
  );
  if (sources.length === 0) {
    return { cards: [], endCursor: null, hasNextPage: false };
  }

  const languages = await enabledLanguageIdsOf(c, sources);
  const limit = first + 1;

  const branches = await Promise.all(
    sources.map(async source => {
      const columns = source.model.columns as Record<string, PgColumn>;
      const table: PgTable = source.model.table;
      const at = columns.publishedAt;
      const idKey = idKeyExpression(source.model, columns.id);

      return sql`(${c
        .get("db")
        .select({
          at: sql<string>`to_char(${at}, ${AT_FORMAT})`.as("at"),
          id: sql<string>`${columns.id}::text`.as("id"),
          key: sql<string>`${idKey} collate "C"`.as("key"),
          type: sql<string>`${source.type.id}::text`.as("type"),
        })
        .from(table)
        .where(
          and(
            await profileCondition(c, source, userId, languages),
            afterCursor(source, at, idKey, after),
          ),
        )
        .orderBy(sql`${at} desc`, sql`${idKey} collate "C" desc`)
        .limit(limit)})`;
    }),
  );

  const rows = (await c
    .get("db")
    .execute(
      sql`select at, id, key, type from (${sql.join(branches, sql` union all `)}) as profile_content order by at collate "C" desc, type collate "C" desc, key collate "C" desc limit ${limit}`,
    )) as unknown as { at: string; id: string; key: string; type: string }[];

  const page = [...rows].slice(0, first);
  const hasNextPage = rows.length > first;
  const last = page.at(-1);

  const documents = new Map<string, SearchDocument>();
  await Promise.all(
    sources.map(async source => {
      const definition = contentDefinitionOf(source.model);
      const ids = page
        .filter(row => row.type === source.type.id)
        .map(row => parseContentId(definition.idStrategy, row.id))
        .filter((id): id is ContentId => id !== null);
      if (ids.length === 0) return;

      const loaded = await loadContentSearchDocumentsByIds(c, {
        ids,
        locale,
        model: source.model,
        pluginId: source.type.pluginId,
      });
      for (const [key, document] of loaded) {
        documents.set(`${source.type.id}:${key}`, document);
      }
    }),
  );

  const pluginOf = new Map(
    sources.map(source => [source.type.id, source.type.pluginId]),
  );
  const drafts = page.flatMap(row => {
    const document = documents.get(`${row.type}:${contentIdKey(row.id)}`);

    return document ? [toDraft(document, pluginOf.get(row.type) ?? "")] : [];
  });
  const search = c.get("search");
  const [withAuthors, withImages] = await Promise.all([
    search.hydrateAuthors(
      drafts.map(draft => ({ ...draft, author: null, authorId: null })),
    ),
    search.hydrateImages(drafts),
  ]);
  const cards = withAuthors.map(
    (
      {
        author: _author,
        authorId: _authorId,
        authorIds: _ids,
        imageId: _image,
        ...card
      },
      index,
    ): ContentProfileCard => ({
      ...card,
      image: withImages[index]?.image ?? null,
    }),
  );

  return {
    cards,
    endCursor:
      hasNextPage && last
        ? {
            at: last.at,
            id: last.key,
            type: last.type,
          }
        : null,
    hasNextPage,
  };
};
