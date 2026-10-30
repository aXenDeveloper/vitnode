import type { Context } from "hono";

import { z } from "@hono/zod-openapi";

import type { ContentId } from "../../ids";
import type { AnyContentModel } from "../../server/model";
import type { ContentAccessActor } from "../policy";

import { contentAccessTag } from "../../cache";
import { contentIdKey } from "../../ids";
import { CONTENT_ACCESS_REQUIRED_CODE } from "../const";
import { contentRecordAccessFlags } from "./decide";
import { contentAccessFamilyOf, isContentAccessOpen } from "./source";

/** The headers of a response that depends on who is asking. */
export const CONTENT_ACCESS_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
} as const;

/**
 * A role, synthetic and internal, that passes every access rule. Only for
 * existence checks whose answer never reaches a client as content.
 */
export const CONTENT_ACCESS_SYSTEM_ACTOR: ContentAccessActor = {
  kind: "member",
  roleIds: [],
  root: true,
  userId: 0,
};

/** The body of a 403 for a scope the viewer may see but not read. */
export const zodContentAccessRequired = z.object({
  accessRequired: z.literal(true),
  code: z.literal(CONTENT_ACCESS_REQUIRED_CODE),
});

export const contentAccessRequiredResponse = (c: Context) =>
  c.json(
    { accessRequired: true as const, code: CONTENT_ACCESS_REQUIRED_CODE },
    403,
    CONTENT_ACCESS_PRIVATE_HEADERS,
  );

/**
 * Whether a public response for `model` may be shared by every viewer: no
 * access rule can change it. Otherwise it must be `private, no-store` and stay
 * out of every shared cache (the API's public-read cache and the page cache).
 */
export const isContentAccessShareable = async (
  c: Context,
  model: AnyContentModel,
): Promise<boolean> => await isContentAccessOpen(c, model);

/** The extra page-cache tag of a shareable response from an access family. */
export const contentAccessPageCacheTags = (
  c: Context,
  model: AnyContentModel,
): string[] => {
  const family = contentAccessFamilyOf(c, model);

  return family ? [contentAccessTag(family.id)] : [];
};

/**
 * For a record the viewer cannot read: `"accessRequired"` when it exists and
 * the viewer may see every scope it is in (so a page can say "sign in" or
 * "you need access"), `"notFound"` otherwise - a hidden scope never confirms
 * that anything is filed in it.
 */
export const contentAccessMissReason = async (
  c: Context,
  model: AnyContentModel,
  id: ContentId,
): Promise<"accessRequired" | "notFound"> => {
  const flags = (await contentRecordAccessFlags(c, model, [id])).get(
    contentIdKey(id),
  );

  return flags?.canView && !flags.canRead ? "accessRequired" : "notFound";
};
