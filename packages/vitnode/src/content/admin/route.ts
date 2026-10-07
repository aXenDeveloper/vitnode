import type { ContentId, ContentIdStrategy } from "../ids";
import type { AnyContentTypeDefinition } from "../types";

import {
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
} from "../const";
import { parseContentId } from "../ids";

/** What `/admin/content/[...slug]` was actually asked for. */
export type ContentAdminAction = "create" | "edit" | "list";

export interface ContentAdminRoute {
  action: ContentAdminAction;
  /** The content type id the slug resolved to. */
  contentTypeId: string;
  /**
   * The record being edited. Only ever set for `edit`: a number for a `serial`
   * content type, the canonical string for a `uuid` or `bigint` one.
   */
  itemId?: ContentId;
}

export type ContentTypeLookup = (
  adminPath: string,
) => AnyContentTypeDefinition | undefined;

/**
 * The record id in an edit URL, under the content type's own strategy.
 *
 * A `serial` id is a positive integer - `01`, `1.5` and `-1` are not. A `uuid`
 * is its canonical lowercase spelling and a `bigint` its decimal digits, so one
 * record has exactly one edit URL.
 */
const parseItemId = (
  strategy: ContentIdStrategy,
  segment: string | undefined,
): ContentId | null => {
  if (segment === undefined) return null;
  if (strategy !== "serial") return parseContentId(strategy, segment);
  if (!/^[1-9][0-9]*$/.test(segment)) return null;

  const id = Number(segment);

  return Number.isSafeInteger(id) ? id : null;
};

export const resolveContentAdminRoute = (
  slug: readonly string[],
  lookup: ContentTypeLookup,
): ContentAdminRoute | undefined => {
  if (slug.length === 0) return undefined;

  const exact = lookup(slug.join("/"));
  if (exact) return { action: "list", contentTypeId: exact.id };

  const last = slug[slug.length - 1];

  if (last === CONTENT_ADMIN_CREATE_SEGMENT) {
    const definition = lookup(slug.slice(0, -1).join("/"));
    if (definition?.admin.create.mode !== "page") return undefined;

    return { action: "create", contentTypeId: definition.id };
  }

  if (last === CONTENT_ADMIN_EDIT_SEGMENT) {
    // The definition first: which spelling is an id depends on its strategy.
    const definition = lookup(slug.slice(0, -2).join("/"));
    if (definition?.admin.edit.mode !== "page") return undefined;

    const itemId = parseItemId(definition.idStrategy, slug[slug.length - 2]);
    if (itemId === null) return undefined;

    return { action: "edit", contentTypeId: definition.id, itemId };
  }

  return undefined;
};
