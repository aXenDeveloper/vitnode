import type { Context } from "hono";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentVisibilityAction } from "../visibility";
import type { ContentModel } from "./model";

import { resolveOwnContentPolicy } from "../../api/lib/own-content-policy";
import { CONTENT_PERMISSIONS } from "../const";
import {
  canModerateContent,
  resolveContentRowContainer,
} from "../containers/server/policy";
import { isContentHidden } from "../visibility";
import {
  canEditContentType,
  canModerateContentVisibility,
} from "./hidden-access";
import { contentPublicWriteOwnerOf } from "./public-write-authorization";

interface ContentRecordAccessArgs<
  TDefinition extends AnyContentTypeDefinition,
> {
  model: ContentModel<TDefinition>;
  pluginId: string;
  row: Record<string, unknown>;
}

const isOwnerOf = (
  c: Context,
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): boolean => {
  const user = c.get("user");

  return (
    user !== null && contentPublicWriteOwnerOf(definition, row) === user.id
  );
};

/**
 * Whether the visitor may hide or unhide this record from the site. Moderators
 * (`can_hide`) may do both to any record. Its author may when one of their roles
 * has "Allow hiding own content" - and may unhide only what they hid
 * themselves, never what a moderator hid. Without `action`, the one the
 * record's state calls for. Server-only.
 */
export const canHideContentRecord = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  {
    action,
    model,
    pluginId,
    row,
  }: ContentRecordAccessArgs<TDefinition> & {
    action?: ContentVisibilityAction;
  },
): Promise<boolean> => {
  const { definition } = model;
  const user = c.get("user");
  if (!user || !definition.visibility.enabled) return false;

  const itemId = row.id as ContentId;
  if (await canModerateContentVisibility(c, { itemId, model, pluginId })) {
    return true;
  }
  if (!isOwnerOf(c, definition, row)) return false;
  if (!(await resolveOwnContentPolicy(c, user)).hide) return false;

  const unhiding =
    (action ?? (isContentHidden(row) ? "unhide" : "hide")) === "unhide";

  return unhiding ? row.hiddenBy === user.id : true;
};

/**
 * Whether the visitor may delete this record from the site: a moderator with
 * `can_delete` for the record's container, staff with the AdminCP
 * `can_delete`, or its author when one of their roles has "Allow deleting own
 * content". Server-only.
 */
export const canDeleteContentRecord = async <
  TDefinition extends AnyContentTypeDefinition,
>(
  c: Context,
  { model, pluginId, row }: ContentRecordAccessArgs<TDefinition>,
): Promise<boolean> => {
  const { definition } = model;
  const user = c.get("user");
  if (!user || !definition.publicWrite.enabled) return false;
  if (row.deletedAt !== null && row.deletedAt !== undefined) return false;

  const container = await resolveContentRowContainer(
    c,
    c.get("db"),
    definition,
    row,
  );
  if (
    (await canModerateContent(c, {
      container,
      definition,
      permission: CONTENT_PERMISSIONS.delete,
      pluginId,
    })) ||
    (await canEditContentType(c, {
      definition,
      permission: CONTENT_PERMISSIONS.delete,
      pluginId,
    }))
  ) {
    return true;
  }

  return (
    isOwnerOf(c, definition, row) &&
    (await resolveOwnContentPolicy(c, user)).delete
  );
};
