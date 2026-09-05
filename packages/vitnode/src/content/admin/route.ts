import type { AnyContentTypeDefinition } from "../types";

import {
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
} from "../const";

/** What `/admin/content/[...slug]` was actually asked for. */
export type ContentAdminAction = "create" | "edit" | "list";

export interface ContentAdminRoute {
  action: ContentAdminAction;
  /** The content type id the slug resolved to. */
  contentTypeId: string;
  /** The record being edited. Only ever set for `edit`. */
  itemId?: number;
}

export type ContentTypeLookup = (
  adminPath: string,
) => AnyContentTypeDefinition | undefined;

/** Only a positive integer is a record id - `01`, `1.5` and `-1` are not. */
const parseItemId = (segment: string | undefined): null | number => {
  if (segment === undefined || !/^[1-9][0-9]*$/.test(segment)) return null;

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
    const itemId = parseItemId(slug[slug.length - 2]);
    if (itemId === null) return undefined;

    const definition = lookup(slug.slice(0, -2).join("/"));
    if (definition?.admin.edit.mode !== "page") return undefined;

    return { action: "edit", contentTypeId: definition.id, itemId };
  }

  return undefined;
};
