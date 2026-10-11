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
  itemId?: ContentId;
}

export type ContentTypeLookup = (
  adminPath: string,
) => AnyContentTypeDefinition | undefined;

const parseItemId = (
  strategy: ContentIdStrategy,
  segment: string | undefined,
): ContentId | null =>
  segment === undefined ? null : parseContentId(strategy, segment);

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
    const definition = lookup(slug.slice(0, -2).join("/"));
    if (definition?.admin.edit.mode !== "page") return undefined;

    const itemId = parseItemId(definition.idStrategy, slug[slug.length - 2]);
    if (itemId === null) return undefined;

    return { action: "edit", contentTypeId: definition.id, itemId };
  }

  return undefined;
};
