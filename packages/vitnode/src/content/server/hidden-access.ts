import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { SearchHiddenAccess } from "../../api/models/search";
import type { ContentId } from "../ids";
import type { RegisteredContentType } from "../registry";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentPublicHiddenAccess } from "./hidden-list";
import type { ContentModel } from "./model";

import { checkStaffPermissionOfUser } from "../../api/lib/check-staff-permission";
import { MODERATION_PERMISSIONS } from "../../lib/moderation/const";
import { CONTENT_PERMISSIONS } from "../const";
import { parseContentId } from "../ids";
import { contentViewableHiddenCondition } from "./hidden-list";
import { toAuthorIds } from "./search-document";

export const canEditContentType = async (
  c: Context,
  {
    definition,
    permission = CONTENT_PERMISSIONS.edit,
    pluginId,
  }: {
    definition: AnyContentTypeDefinition;
    permission?: string;
    pluginId: string;
  },
): Promise<boolean> => {
  const user = c.get("user");
  if (!user) return false;

  return await checkStaffPermissionOfUser(c, user, {
    module: definition.permissionModule,
    permission,
    plugin: pluginId,
    type: "admin",
  });
};

export const contentAuthorIds = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  model: ContentModel<TDefinition>,
  itemId: ContentId,
): Promise<number[]> => {
  // A record's authors: the search author field, or else the public write
  // owner - the member who wrote it from the site.
  const field =
    model.definition.search.authorField ??
    model.definition.publicWrite.ownerField;
  if (!field) return [];

  if (model.advanced.fields.includes(field)) {
    const values = await model.advanced.load(itemId, c.get("db"), [field]);

    return toAuthorIds(values[field]);
  }

  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const column = columns[field];
  if (!column) return [];

  const [row] = await c
    .get("db")
    .select({ value: column })
    .from(table)
    .where(eq(columns.id, itemId))
    .limit(1);

  return toAuthorIds(row?.value);
};

const hasModeratorPermission = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  {
    itemId,
    model,
    permission,
    pluginId,
  }: {
    itemId: ContentId;
    model: ContentModel<TDefinition>;
    permission: string;
    pluginId: string;
  },
): Promise<boolean> => {
  const user = c.get("user");
  if (!user) return false;

  let resource: undefined | { family: string; id: string };
  if (model.moderationScope) {
    const columns = model.columns as Record<string, PgColumn>;
    const table: PgTable = model.table;
    const column = columns[model.moderationScope.column];
    if (!column) return false;
    const [row] = await c
      .get("db")
      .select({ value: column })
      .from(table)
      .where(eq(columns.id, itemId))
      .limit(1);
    const value: unknown = row?.value;
    resource = {
      family: model.moderationScope.family,
      id:
        typeof value === "number" || typeof value === "string"
          ? String(value)
          : "",
    };
  }

  return await checkStaffPermissionOfUser(c, user, {
    module: model.definition.permissionModule,
    permission,
    plugin: pluginId,
    resource,
    type: "moderator",
  });
};

const canModeratorViewHidden = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  args: {
    itemId: ContentId;
    model: ContentModel<TDefinition>;
    pluginId: string;
  },
): Promise<boolean> =>
  args.model.definition.reports.enabled &&
  (await hasModeratorPermission(c, {
    ...args,
    permission: MODERATION_PERMISSIONS.viewHidden,
  }));

/**
 * Whether the visitor may hide and unhide any record of this type from the
 * site: a moderator with `can_hide` on the content type (within its scope), or
 * staff with the AdminCP `can_hide` permission. Needs `visibility`.
 * Server-only.
 */
export const canModerateContentVisibility = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  {
    itemId,
    model,
    pluginId,
  }: { itemId: ContentId; model: ContentModel<TDefinition>; pluginId: string },
): Promise<boolean> => {
  const { definition } = model;
  if (!definition.visibility.enabled) return false;

  return (
    (await canEditContentType(c, {
      definition,
      permission: CONTENT_PERMISSIONS.hide,
      pluginId,
    })) ||
    (await hasModeratorPermission(c, {
      itemId,
      model,
      permission: MODERATION_PERMISSIONS.hide,
      pluginId,
    }))
  );
};

const canModeratorViewAllHidden = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  { model, pluginId }: { model: ContentModel<TDefinition>; pluginId: string },
): Promise<boolean> => {
  const user = c.get("user");
  if (!user || !model.definition.reports.enabled || model.moderationScope) {
    return false;
  }

  return await checkStaffPermissionOfUser(c, user, {
    module: model.definition.permissionModule,
    permission: MODERATION_PERMISSIONS.viewHidden,
    plugin: pluginId,
    type: "moderator",
  });
};

const canViewHiddenContent = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  {
    itemId,
    model,
    pluginId,
  }: { itemId: ContentId; model: ContentModel<TDefinition>; pluginId: string },
): Promise<boolean> => {
  const user = c.get("user");
  if (!user) return false;

  const authors = await contentAuthorIds(c, model, itemId);
  if (authors.includes(user.id)) return true;

  if (
    await canEditContentType(c, {
      definition: model.definition,
      pluginId,
    })
  ) {
    return true;
  }

  return await canModeratorViewHidden(c, { itemId, model, pluginId });
};

export const canViewHiddenContentRecord = async (
  c: Context,
  { contentTypeId, itemId }: { contentTypeId: string; itemId: ContentId },
): Promise<boolean> => {
  const entry = (c.get("core")?.contentModels ?? []).find(
    candidate => candidate.model.definition.id === contentTypeId,
  );
  if (!entry?.model.definition.visibility.enabled) return false;

  return await canViewHiddenContent(c, {
    itemId,
    model: entry.model,
    pluginId: entry.pluginId,
  });
};

export const findViewableHiddenBySlug = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  {
    locale,
    model,
    pluginId,
    slug,
  }: {
    locale: string | undefined;
    model: ContentModel<TDefinition>;
    pluginId: string;
    slug: string;
  },
): Promise<null | Record<string, unknown>> => {
  const { definition } = model;
  if (!definition.visibility.enabled || !c.get("user")) return null;

  const row = await model
    .publicService?.(c)
    .findBySlug(slug, { fallback: true, hidden: true, locale });
  if (!row) return null;

  const values = row as Record<string, unknown>;
  const itemId = parseContentId(definition.idStrategy, values.id);
  if (itemId === null) return null;

  return (await canViewHiddenContent(c, { itemId, model, pluginId }))
    ? values
    : null;
};

/**
 * Which hidden records a public list may add for the signed-in viewer, or
 * `undefined` when there are none they may see - then the list is the same
 * for everybody and can be cached. Server-only.
 *
 * Editors (`can_edit`) and unscoped moderators (`can_view_hidden`) get every
 * hidden record; authors get the ones `search.authorField` names them in.
 */
export const contentListHiddenAccess = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  { model, pluginId }: { model: ContentModel<TDefinition>; pluginId: string },
): Promise<ContentPublicHiddenAccess | undefined> => {
  const user = c.get("user");
  const { definition } = model;
  if (!user || !definition.visibility.enabled) return undefined;

  const access: ContentPublicHiddenAccess = {
    all:
      (await canEditContentType(c, { definition, pluginId })) ||
      (await canModeratorViewAllHidden(c, { model, pluginId })),
    authorId: user.id,
  };
  const columns = model.columns as Record<string, PgColumn>;
  const viewable = contentViewableHiddenCondition(
    { advanced: model.advanced, columns, definition },
    access,
  );
  if (!viewable) return undefined;

  const table: PgTable = model.table;
  const [row] = await c
    .get("db")
    .select({ id: columns.id })
    .from(table)
    .where(viewable)
    .limit(1);

  return row ? access : undefined;
};

export const contentSearchHiddenAccess = async (
  c: Context,
): Promise<SearchHiddenAccess | undefined> => {
  const user = c.get("user");
  if (!user) return undefined;

  const contentTypes: readonly RegisteredContentType[] =
    c.get("core")?.contentTypes ?? [];
  const editable = await Promise.all(
    contentTypes
      .filter(
        ({ definition }) =>
          definition.search.enabled && definition.visibility.enabled,
      )
      .map(async ({ definition, pluginId }) =>
        (await canEditContentType(c, { definition, pluginId }))
          ? [definition.id]
          : [],
      ),
  );

  return { authorId: user.id, itemTypes: editable.flat() };
};

/**
 * Which hidden records of a thread the visitor may read: every one for
 * editors and unscoped moderators (`all`), otherwise the ones they own. A
 * thread read with it is personal - never cache it. `undefined` for guests and
 * types without `visibility`. Server-only.
 */
export const contentThreadHiddenAccess = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  { model, pluginId }: { model: ContentModel<TDefinition>; pluginId: string },
): Promise<ContentPublicHiddenAccess | undefined> => {
  const user = c.get("user");
  if (!user || !model.definition.visibility.enabled) return undefined;

  return {
    all:
      (await canEditContentType(c, {
        definition: model.definition,
        pluginId,
      })) || (await canModeratorViewAllHidden(c, { model, pluginId })),
    authorId: user.id,
  };
};
