import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentVisibilityAction } from "../visibility";
import type { AnyContentModel, ContentModel } from "./model";

import { buildRoute } from "../../api/lib/route";
import { canAccessContentRecord } from "../access/server/decide";
import { contentTypeName } from "../admin/labels";
import { CONTENT_HIDDEN_REASON_MAX_LENGTH } from "../const";
import { contentIdKey } from "../ids";
import { resolveContentActor } from "./actor";
import {
  canDeleteContentRecord,
  canHideContentRecord,
} from "./content-actions-access";
import { contentEditorialEffects } from "./editorial-effects";
import { emitContentEvent } from "./emit";
import { withHttpErrors } from "./http-errors";
import { resetContentLiveRecord } from "./live/hooks";
import { contentPublicStateOf } from "./page-cache";
import { visibilityAction } from "./report-target";
import { contentIdentifier, jsonBody, readOptionalJson } from "./route-helpers";
import { syncContentSearch } from "./search-sync";
import { isContentBaseRowPublic } from "./visibility";

/**
 * The row, but only when the viewer may read it under the access rules of its
 * scopes: an action on a record somebody may not read is the same 404 as on
 * one that does not exist - moderators included, who act from the site with
 * their own roles.
 */
const readRow = async (
  c: Context,
  model: AnyContentModel,
  id: ContentId,
): Promise<Record<string, unknown> | undefined> => {
  const [row] = (await c
    .get("db")
    .select()
    .from(model.table)
    .where(eq(model.columns.id as never, id))
    .limit(1)) as Record<string, unknown>[];
  if (!row) return undefined;

  return (await canAccessContentRecord(c, { action: "read", id, model }))
    ? row
    : undefined;
};

/**
 * `POST /{publicApi.path}/{id}/hide` and `.../unhide`: hide or show a published
 * record from the site, through the same editorial path a ModCP report action
 * takes - revisions, search, caches and events included. Moderators may do it
 * to any record; authors to their own when a role allows it, and they may only
 * unhide what they hid themselves. Mounted for content types with
 * `visibility`. Server-only.
 */
export const contentPublicVisibilityRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const anyModel = model as unknown as AnyContentModel;
  const name = contentTypeName(definition.id);

  const response = {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            changed: z.boolean(),
            hidden: z.boolean(),
            id: schemas.params.shape.id,
          }),
        },
      },
      description: `The ${name}'s visibility now`,
    },
    401: { description: "Not signed in" },
    403: { description: `Not allowed to change this ${name}` },
    404: { description: `${name} not found, or not published` },
  };

  const changeVisibility = async (
    c: Context,
    action: ContentVisibilityAction,
    reason: null | string,
  ) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "Sign in first." });

    const id = contentIdentifier(c, definition);
    const row = await readRow(c, anyModel, id);
    if (!row || !isContentBaseRowPublic({ ...row, hiddenAt: null })) {
      throw new HTTPException(404, { message: `${name} not found.` });
    }
    if (!(await canHideContentRecord(c, { action, model, pluginId, row }))) {
      throw new HTTPException(403, {
        message: `You cannot ${action} this ${name}.`,
      });
    }

    const table: PgTable = model.table;
    const columns = model.columns as Record<string, PgColumn>;
    const { run } = visibilityAction(anyModel, pluginId, action);
    const outcome = await c.get("db").transaction(async tx => {
      const result = await run(c, {
        actorUserId: user.id,
        targetId: contentIdKey(id),
        tx,
      });
      if (result && reason) {
        await tx
          .update(table)
          .set({ hiddenReason: reason })
          .where(eq(columns.id, id as never));
      }

      return result;
    });
    if (!outcome) {
      throw new HTTPException(404, { message: `${name} not found.` });
    }
    await outcome.effects();

    return c.json(
      { changed: outcome.changed, hidden: action === "hide", id },
      200,
      { "Cache-Control": "private, no-store" },
    );
  };

  const hideBody = z.object({
    reason: z.string().trim().max(CONTENT_HIDDEN_REASON_MAX_LENGTH).optional(),
  });

  const hide = buildRoute({
    pluginId,
    route: {
      method: "post",
      path: "/{id}/hide",
      description: `Hide a published ${name} from the site, as a moderator or its author, with an optional reason its author and the moderators see`,
      request: {
        params: schemas.params,
        body: { ...jsonBody(hideBody), required: false },
      },
      responses: response,
    },
    handler: async c => {
      const { reason = "" } = await readOptionalJson(c, hideBody);

      return await changeVisibility(c, "hide", reason === "" ? null : reason);
    },
  });

  const unhide = buildRoute({
    pluginId,
    route: {
      method: "post",
      path: "/{id}/unhide",
      description: `Show a hidden ${name} on the site again, as a moderator or the author who hid it`,
      request: { params: schemas.params },
      responses: response,
    },
    handler: async c => await changeVisibility(c, "unhide", null),
  });

  return [hide, unhide] as const;
};

/**
 * `POST /{publicApi.path}/{id}/delete`: delete a record from the site, through
 * the same path the AdminCP takes - a final revision for an editorial type,
 * then search, caches, live editing and events. A thread reply that still has
 * answers is kept as an anonymous placeholder instead (`deletedAt`), so its
 * answers stay in place; deleting its last answer removes the placeholder
 * too. Moderators with `can_delete` may delete any record; authors their own
 * when a role allows it. Mounted for content types with `publicWrite`.
 * Server-only.
 */
export const contentPublicDeleteRoute = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const name = contentTypeName(definition.id);

  return buildRoute({
    pluginId,
    route: {
      method: "post",
      path: "/{id}/delete",
      description: `Delete a ${name}, as a moderator or its author`,
      request: { params: schemas.params },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ id: schemas.params.shape.id }),
            },
          },
          description: `${name} deleted`,
        },
        401: { description: "Not signed in" },
        403: { description: `Not allowed to delete this ${name}` },
        404: { description: `${name} not found` },
        409: { description: "Still referenced by other content" },
      },
    },
    handler: async c => {
      const user = c.get("user");
      if (!user) throw new HTTPException(401, { message: "Sign in first." });

      const id = contentIdentifier(c, definition);
      const row = await readRow(c, model, id);
      if (!row) throw new HTTPException(404, { message: `${name} not found.` });
      if (!(await canDeleteContentRecord(c, { model, pluginId, row }))) {
        throw new HTTPException(403, {
          message: `You cannot delete this ${name}.`,
        });
      }

      const { parentField } = definition.thread;
      const table: PgTable = model.table;
      const columns = model.columns as Record<string, PgColumn>;
      const parentColumn = definition.thread.enabled
        ? columns[parentField]
        : undefined;
      const hasReplies = async (itemId: unknown): Promise<boolean> => {
        if (!parentColumn) return false;
        const [reply] = await c
          .get("db")
          .select({ id: columns.id })
          .from(table)
          .where(eq(parentColumn, itemId as never))
          .limit(1);

        return reply !== undefined;
      };

      const removeRow = async (target: Record<string, unknown>) => {
        const targetId = target.id as ContentId;
        if (definition.editorial.enabled && model.editorialService) {
          const editorial = model.editorialService(c, { pluginId });
          const result = await withHttpErrors(
            "delete",
            async () =>
              await editorial.delete(targetId as never, {
                actor: resolveContentActor(c),
                expectedVersion:
                  typeof target.version === "number" ? target.version : 0,
              }),
            {
              contentTypeId: definition.id,
              itemId: targetId,
              structured: true,
            },
          );
          if (!result) return;
          await contentEditorialEffects(c, definition, result, {
            model,
            pluginId,
          });
          await resetContentLiveRecord(
            c,
            { contentTypeId: definition.id, itemId: targetId },
            "deleted",
          );

          return;
        }

        const deleted = await withHttpErrors(
          "delete",
          async () => await model.service(c).delete(targetId as never),
        );
        if (!deleted) return;
        await emitContentEvent(
          c,
          definition,
          "deleted",
          { contentId: deleted.id },
          {
            pluginId,
            publicState: contentPublicStateOf(definition, deleted, null),
            row: deleted,
          },
        );
        await syncContentSearch(c, definition, {
          operation: "delete",
          pluginId,
          row: deleted,
        });
      };

      if (await hasReplies(id)) {
        await c
          .get("db")
          .update(table)
          .set({ deletedAt: new Date(), deletedBy: user.id })
          .where(eq(columns.id, id as never));
        await emitContentEvent(
          c,
          definition,
          "deleted",
          { contentId: id },
          {
            pluginId,
            publicState: contentPublicStateOf(definition, row, null),
            row,
          },
        );
        await syncContentSearch(c, definition, {
          operation: "delete",
          pluginId,
          row,
        });

        return c.json({ id }, 200, { "Cache-Control": "private, no-store" });
      }

      await removeRow(row);

      let parentId = parentColumn ? row[parentField] : null;
      while (parentId !== null && parentId !== undefined) {
        const parent = await readRow(c, model, parentId as ContentId);
        if (
          !parent ||
          parent.deletedAt === null ||
          parent.deletedAt === undefined ||
          (await hasReplies(parentId))
        ) {
          break;
        }
        await removeRow(parent);
        parentId = parent[parentField];
      }

      return c.json({ id }, 200, { "Cache-Control": "private, no-store" });
    },
  });
};
