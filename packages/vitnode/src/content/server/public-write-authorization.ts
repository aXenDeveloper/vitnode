import type { Context } from "hono";

import type { EffectiveContentContainerPolicy } from "../containers/policies";
import type { ContentRecordContainer } from "../containers/server/policy";
import type { ContentActor } from "../revisions";
import type { AnyContentTypeDefinition } from "../types";

import { CONTENT_PERMISSIONS } from "../const";
import { contentAuthorMayEdit } from "../containers/policies";
import { canModerateContent } from "../containers/server/policy";
import { isContentBaseRowPublic } from "./visibility";

export interface ContentPublicWriteActor extends ContentActor {
  type: "api";
  userId: number;
}

export const resolveContentPublicWriteActor = (
  c: Context,
): ContentPublicWriteActor | null => {
  const user = c.get("user");

  return user ? { type: "api", userId: user.id } : null;
};

export const contentPublicWriteOwnerOf = (
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): null | number => {
  const field = definition.publicWrite.ownerField;
  const value = field === null ? null : row[field];

  return typeof value === "number" ? value : null;
};

export interface ContentPublicWriteAuthorizationInput {
  action: "update";
  actor: ContentPublicWriteActor;
  container?: ContentRecordContainer | null;
  definition: AnyContentTypeDefinition;
  pluginId: string;
  policy?: EffectiveContentContainerPolicy | null;
  row: Record<string, unknown>;
}

export type ContentPublicWriteAuthorization =
  | { allowed: false; reason: "editWindowClosed" | null; via: null }
  | { allowed: true; via: "moderator" | "owner" };

/**
 * Who may edit a record from the public site. A moderator holding `can_edit`
 * for the record's container edits anything there, at any age. An owner edits
 * their own record while it is not hidden and the container's `authorEdit`
 * policy still allows it - measured from the row's server `createdAt`.
 */
export const authorizeContentPublicWrite = async (
  c: Context,
  {
    actor,
    container = null,
    definition,
    pluginId,
    policy = null,
    row,
  }: ContentPublicWriteAuthorizationInput,
): Promise<ContentPublicWriteAuthorization> => {
  const { update } = definition.publicWrite;
  if (!update.enabled) return { allowed: false, reason: null, via: null };

  if (
    await canModerateContent(c, {
      container,
      definition,
      permission: CONTENT_PERMISSIONS.edit,
      pluginId,
    })
  ) {
    return { allowed: true, via: "moderator" };
  }

  const hidden = row.hiddenAt !== null && row.hiddenAt !== undefined;
  const owns =
    update.own &&
    !hidden &&
    contentPublicWriteOwnerOf(definition, row) === actor.userId;
  if (!owns) return { allowed: false, reason: null, via: null };

  if (
    policy &&
    !contentAuthorMayEdit(policy.policy, row.createdAt as Date | undefined)
  ) {
    return { allowed: false, reason: "editWindowClosed", via: null };
  }

  return { allowed: true, via: "owner" };
};

export const contentPublicWriteRefusal = (
  row: Record<string, unknown>,
): "forbidden" | "notFound" =>
  isContentBaseRowPublic(row) ? "forbidden" : "notFound";
