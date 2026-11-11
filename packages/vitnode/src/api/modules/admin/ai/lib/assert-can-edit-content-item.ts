import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { ContentId } from "@/content/ids";

import { checkStaffPermission } from "@/api/lib/check-staff-permission";
import { contentIdKey, parseContentId } from "@/content/ids";

export const assertCanEditContentItem = async (
  c: Context,
  contentTypeId: string,
  requestedItemId: ContentId,
): Promise<string> => {
  const registered = c
    .get("core")
    .contentTypes.find(entry => entry.definition.id === contentTypeId);
  if (!registered) {
    throw new HTTPException(404, { message: "Unknown content type" });
  }
  const allowed = await checkStaffPermission(c, {
    module: registered.definition.permissionModule,
    permission: "can_edit",
    plugin: registered.pluginId,
    type: "admin",
  });
  if (!allowed) throw new HTTPException(403);

  const itemId = parseContentId(
    registered.definition.idStrategy,
    requestedItemId,
  );
  if (itemId === null) {
    throw new HTTPException(400, { message: "Invalid identifier." });
  }

  return contentIdKey(itemId);
};
