import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { SearchHiddenAccess } from "../../api/models/search";
import type { ContentId } from "../ids";
import type { RegisteredContentType } from "../registry";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { checkStaffPermissionOfUser } from "../../api/lib/check-staff-permission";
import { CONTENT_PERMISSIONS } from "../const";
import { parseContentId } from "../ids";
import { toAuthorIds } from "./search-document";

const canEditContentType = async (
  c: Context,
  {
    definition,
    pluginId,
  }: { definition: AnyContentTypeDefinition; pluginId: string },
): Promise<boolean> => {
  const user = c.get("user");
  if (!user) return false;

  return await checkStaffPermissionOfUser(c, user, {
    module: definition.permissionModule,
    permission: CONTENT_PERMISSIONS.edit,
    plugin: pluginId,
    type: "admin",
  });
};

const contentAuthorIds = async <TDefinition extends AnyContentTypeDefinition>(
  c: Context,
  model: ContentModel<TDefinition>,
  itemId: ContentId,
): Promise<number[]> => {
  const field = model.definition.search.authorField;
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

  return await canEditContentType(c, {
    definition: model.definition,
    pluginId,
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
