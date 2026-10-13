import type { Context } from "hono";

import type { ContentActor } from "../revisions";
import type { AnyContentTypeDefinition } from "../types";

import { checkStaffPermission } from "../../api/lib/check-staff-permission";
import { CONTENT_PERMISSIONS } from "../const";
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
  definition: AnyContentTypeDefinition;
  pluginId: string;
  row: Record<string, unknown>;
}

export type ContentPublicWriteAuthorization =
  | { allowed: false; via: null }
  | { allowed: true; via: "moderator" | "owner" };

export const authorizeContentPublicWrite = async (
  c: Context,
  { actor, definition, pluginId, row }: ContentPublicWriteAuthorizationInput,
): Promise<ContentPublicWriteAuthorization> => {
  const { update } = definition.publicWrite;
  if (!update.enabled) return { allowed: false, via: null };

  const hidden = row.hiddenAt !== null && row.hiddenAt !== undefined;
  if (
    update.own &&
    !hidden &&
    contentPublicWriteOwnerOf(definition, row) === actor.userId
  ) {
    return { allowed: true, via: "owner" };
  }

  const moderator = await checkStaffPermission(c, {
    module: definition.permissionModule,
    permission: CONTENT_PERMISSIONS.edit,
    plugin: pluginId,
    type: "moderator",
  });

  return moderator
    ? { allowed: true, via: "moderator" }
    : { allowed: false, via: null };
};

export const contentPublicWriteRefusal = (
  row: Record<string, unknown>,
): "forbidden" | "notFound" =>
  isContentBaseRowPublic(row) ? "forbidden" : "notFound";
