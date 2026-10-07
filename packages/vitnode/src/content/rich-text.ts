import type { ContentFieldDescriptor, ContentFieldMap } from "./types";

import { analyzeHtml, isHtmlEmpty, stripHtml } from "../lib/strip-html";
import {
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_IDENTIFIER_MAX_LENGTH,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_RICH_TEXT_MAX_HTML_LENGTH,
  CONTENT_RICH_TEXT_SEARCH_SUFFIX,
  CONTENT_SYSTEM_FIELDS,
  CONTENT_TRANSLATION_PUBLICATION_FIELDS,
  CONTENT_TRANSLATION_SYSTEM_FIELDS,
  CONTENT_VISIBILITY_FIELDS,
} from "./const";
import { resolveFieldTarget } from "./define-shared";
import { ContentEngineError } from "./errors";
import {
  contentLeafColumnName,
  contentStorageColumns,
  splitContentFieldPath,
} from "./paths";

/**
 * Rich text rules that hold in the browser and on the server alike.
 *
 * Nothing here sanitises: that is `content/server/rich-text.ts`, which runs
 * these same rules again on the sanitised value - the one that is stored.
 */

interface RichTextRules {
  maxLength?: number;
  minLength?: number;
  required: boolean;
}

/** Whether rich text holds nothing a reader would get. See {@link isHtmlEmpty}. */
export const isContentRichTextEmpty = (html: string): boolean =>
  isHtmlEmpty(html);

/** The plain text a rich text value's length limits and search read. */
export const contentRichTextPlainText = (html: string): string =>
  stripHtml(html);

/**
 * Why `html` breaks a rich text field's rules, or `null` when it does not.
 *
 * An empty value of an optional field is never too short: "no body" is a value
 * of its own, which the server stores as `null` or `""`.
 */
export const contentRichTextIssue = (
  rules: RichTextRules,
  html: string,
): null | string => {
  if (html.length > CONTENT_RICH_TEXT_MAX_HTML_LENGTH) {
    return `Rich text can hold at most ${CONTENT_RICH_TEXT_MAX_HTML_LENGTH} characters of HTML.`;
  }

  const { hasMedia, text } = analyzeHtml(html);
  const plain = text.replace(/\s+/g, " ");

  if (plain === "" && !hasMedia) {
    return rules.required ? "Required. Add some text or media." : null;
  }

  if (rules.minLength !== undefined && plain.length < rules.minLength) {
    return `Too short: expected at least ${rules.minLength} characters of text.`;
  }

  if (rules.maxLength !== undefined && plain.length > rules.maxLength) {
    return `Too long: expected at most ${rules.maxLength} characters of text.`;
  }

  return null;
};

// ---------------------------------------------------------------------------
// Search projection
//
// A list search is an `ILIKE` on a column, and an `ILIKE` on HTML matches tag
// names and attribute values - `class` finds every article with a styled span.
// A `richText` field a list search names therefore gets a plain-text twin on
// the same table, written beside it on every write, and the search reads that.
// ---------------------------------------------------------------------------

export interface ContentRichTextSearchColumn {
  /** The column holding the HTML. */
  column: string;
  /** Whether both columns live on the translation table. */
  localized: boolean;
  /** The field name or `group.leaf` path a `searchableFields` list names. */
  path: string;
  /** The column holding its plain text. */
  searchColumn: string;
}

interface SearchableDefinition {
  admin: { list: { searchableFields: readonly string[] } };
  fields: ContentFieldMap;
  publicApi: { searchableFields: readonly string[] };
}

const searchColumnsCache = new WeakMap<
  object,
  readonly ContentRichTextSearchColumn[]
>();

export const contentRichTextSearchColumnName = (column: string): string =>
  `${column}${CONTENT_RICH_TEXT_SEARCH_SUFFIX}`;

const resolveSearchColumns = (
  definition: SearchableDefinition,
): ContentRichTextSearchColumn[] => {
  const { fields } = definition;
  const names = [
    ...new Set([
      ...definition.admin.list.searchableFields,
      ...definition.publicApi.searchableFields,
    ]),
  ];
  const resolved: ContentRichTextSearchColumn[] = [];

  for (const path of names) {
    const target = resolveFieldTarget(fields, path);
    if (target?.descriptor.kind !== "richText") continue;
    // A repeatable leaf is never a list search target - `defineContentType`
    // already refuses it - so only a row column or a group leaf gets here.
    if (target.container === "repeatable") continue;

    const parts = splitContentFieldPath(path);
    const owner = parts ? parts[0] : path;
    const column = parts ? contentLeafColumnName(parts[0], parts[1]) : path;

    resolved.push({
      column,
      localized: fields[owner]?.localized === true,
      path,
      searchColumn: contentRichTextSearchColumnName(column),
    });
  }

  return resolved;
};

/**
 * The plain-text search columns a content type generates, one per `richText`
 * field named in `admin.list.searchableFields` or `publicApi.searchableFields`.
 */
export const contentRichTextSearchColumns = (
  definition: SearchableDefinition,
): readonly ContentRichTextSearchColumn[] => {
  const cached = searchColumnsCache.get(definition);
  if (cached) return cached;

  const resolved = resolveSearchColumns(definition);
  searchColumnsCache.set(definition, resolved);

  return resolved;
};

/** The search column for one searchable name, or `null` when it reads its own column. */
export const contentRichTextSearchColumnOf = (
  definition: SearchableDefinition,
  path: string,
): ContentRichTextSearchColumn | null =>
  contentRichTextSearchColumns(definition).find(entry => entry.path === path) ??
  null;

/**
 * Adds the plain text of every search-projected HTML column present in a column
 * record about to be written - the one place the twin is kept in step.
 */
export const withContentRichTextSearchText = (
  searchColumns: readonly ContentRichTextSearchColumn[],
  columns: Record<string, unknown>,
): Record<string, unknown> => {
  if (searchColumns.length === 0) return columns;

  let next = columns;

  for (const entry of searchColumns) {
    if (!(entry.column in columns)) continue;

    const value = columns[entry.column];
    if (next === columns) next = { ...columns };
    next[entry.searchColumn] =
      typeof value === "string" ? stripHtml(value) : null;
  }

  return next;
};

/**
 * Definition-time check that every plain-text search column has a name of its
 * own: a declared field, a generated leaf column or a system column called
 * `bodyText` would otherwise be overwritten on every write.
 */
export const assertContentRichTextSearchColumns = (
  id: string,
  definition: SearchableDefinition,
): void => {
  const searchColumns = resolveSearchColumns(definition);
  if (searchColumns.length === 0) return;

  const taken = new Set<string>([
    ...Object.keys(definition.fields),
    ...Object.keys(contentStorageColumns(definition.fields)),
    ...CONTENT_SYSTEM_FIELDS,
    ...CONTENT_PUBLICATION_FIELDS,
    ...CONTENT_EDITORIAL_FIELDS,
    ...CONTENT_VISIBILITY_FIELDS,
    ...CONTENT_TRANSLATION_SYSTEM_FIELDS,
    ...CONTENT_TRANSLATION_PUBLICATION_FIELDS,
  ]);

  for (const entry of searchColumns) {
    if (taken.has(entry.searchColumn)) {
      throw new ContentEngineError(
        `Rich text field "${entry.path}" is searchable, which generates a plain-text column "${entry.searchColumn}" beside it - and that name is already taken. Rename the field that uses it, or stop searching "${entry.path}".`,
        { contentTypeId: id },
      );
    }

    if (entry.searchColumn.length > CONTENT_IDENTIFIER_MAX_LENGTH) {
      throw new ContentEngineError(
        `Rich text field "${entry.path}" is searchable, which generates a plain-text column "${entry.searchColumn}" - longer than the ${CONTENT_IDENTIFIER_MAX_LENGTH} characters Postgres keeps of an identifier. Shorten the field name.`,
        { contentTypeId: id },
      );
    }

    taken.add(entry.searchColumn);
  }
};

/** Whether a field map holds a `richText` field anywhere, group and repeatable leaves included. */
export const hasContentRichTextField = (fields: ContentFieldMap): boolean =>
  Object.values(fields).some(
    (fieldValue: ContentFieldDescriptor) =>
      fieldValue.kind === "richText" ||
      ((fieldValue.kind === "group" || fieldValue.kind === "repeatable") &&
        Object.values(fieldValue.fields).some(
          leaf => (leaf as ContentFieldDescriptor).kind === "richText",
        )),
  );
