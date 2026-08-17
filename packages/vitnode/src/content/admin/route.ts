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

/**
 * A "does this path exist" predicate, so the resolver stays a pure function.
 *
 * It has to be able to ask, rather than just split on the last segment: a
 * content type is free to live at `blog/post/create`, and the exact match has to
 * win over the create page of `blog/post`.
 *
 * Keyed by `admin.path` rather than by the content type id, because the two are
 * allowed to disagree - `blog.post` answers at `blog/articles`, and no amount of
 * splitting a slug on dots would find it.
 */
export type ContentTypeLookup = (
  adminPath: string,
) => AnyContentTypeDefinition | undefined;

/** Only a positive integer is a record id - `01`, `1.5` and `-1` are not. */
const parseItemId = (segment: string | undefined): null | number => {
  if (segment === undefined || !/^[1-9][0-9]*$/.test(segment)) return null;

  const id = Number(segment);

  return Number.isSafeInteger(id) ? id : null;
};

/**
 * Maps the catch-all slug onto a content type and one of three screens.
 *
 * One route serves all of them, which is the same trade the list screen already
 * made: a second Next.js router keyed on content type ids would mean two files
 * per app per screen, and the whole point of the generated AdminCP is that a
 * plugin adds a content type without adding a file.
 *
 * Resolution order is exact-match-first, and that matters. `blog/post/create` is
 * a legal address for a content type of its own, so `["blog", "post", "create"]`
 * has two readings; the one where a registered content type keeps its own list
 * screen wins, and the create page of `blog/post` is then simply unreachable -
 * which is a name clash its author can see and fix, rather than a screen that
 * silently disappeared.
 *
 * `undefined` for anything that resolves to nothing, and for a form URL of a
 * content type that did not opt into page mode: a dialog-mode content type
 * answering `/create` would be a second, unstyled way into the same form.
 */
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
