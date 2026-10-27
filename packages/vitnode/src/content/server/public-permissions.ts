import type { PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { inArray } from "drizzle-orm";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { buildRoute } from "../../api/lib/route";
import { contentTypeName } from "../admin/labels";
import { CONTENT_PUBLIC_MAX_PAGE_SIZE } from "../const";
import {
  effectiveContentPolicy,
  resolveContentRowContainer,
} from "../containers/server/policy";
import { contentIdKey, parseContentId } from "../ids";
import {
  canDeleteContentRecord,
  canHideContentRecord,
} from "./content-actions-access";
import {
  authorizeContentPublicWrite,
  contentPublicWriteOwnerOf,
} from "./public-write-authorization";
import { isContentBaseRowPublic } from "./visibility";

/** What the current visitor may do with one record. */
export interface ContentViewerPermissions {
  /**
   * `POST /{id}/delete` will accept this visitor: a moderator with
   * `can_delete`, or the author when one of their roles allows deleting own
   * content.
   */
  canDelete: boolean;
  /**
   * `GET /{id}/edit` and `PATCH /{id}` will accept this visitor: the owner
   * while the container's policy allows it, or a moderator with `can_edit`.
   */
  canEdit: boolean;
  /**
   * `POST /{id}/hide` (or `/unhide` for a hidden record) will accept this
   * visitor: a moderator with `can_hide`, or the author when one of their roles
   * allows hiding own content - who may only unhide what they hid themselves.
   * Only for published records of a type with `visibility`.
   */
  canHide: boolean;
  /**
   * A Report button makes sense: the type has `reports`, the record is public
   * and the visitor did not write it - unless `reports.selfReport` lets
   * authors report their own. Guests get `true`; the report dialog asks them
   * to sign in.
   */
  canReport: boolean;
}

const parseIds = (
  definition: AnyContentTypeDefinition,
  raw: string,
): ContentId[] => {
  const ids = new Map<string, ContentId>();
  for (const part of raw.split(",")) {
    const id = parseContentId(definition.idStrategy, part.trim());
    if (id !== null) ids.set(contentIdKey(id), id);
  }

  return [...ids.values()];
};

/**
 * Reads `ids` and decides each record's {@link ContentViewerPermissions} with
 * the same rules the write routes and the report route apply. A record the
 * visitor can neither read publicly nor edit is left out, so the answer never
 * reveals a draft that exists.
 */
export const resolveContentViewerPermissions = async (
  c: Context,
  model: ContentModel<AnyContentTypeDefinition>,
  { ids, pluginId }: { ids: ContentId[]; pluginId: string },
): Promise<(ContentViewerPermissions & { id: ContentId })[]> => {
  if (ids.length === 0) return [];

  const { definition } = model;
  const db = c.get("db");
  const columns = model.columns;
  const table: PgTable = model.table;
  const rows = (await db
    .select()
    .from(table)
    .where(inArray(columns.id, ids))) as Record<string, unknown>[];
  const user = c.get("user");

  const decided = await Promise.all(
    rows.map(async row => {
      const id = row.id as ContentId;
      const isPublic = isContentBaseRowPublic(row);
      const ownerId = contentPublicWriteOwnerOf(definition, row);
      const isOwner = user !== null && ownerId === user.id;

      let canEdit = false;
      if (user && definition.publicWrite.update.enabled) {
        const container = await resolveContentRowContainer(
          c,
          db,
          definition,
          row,
        );
        const decision = await authorizeContentPublicWrite(c, {
          action: "update",
          actor: { type: "api", userId: user.id },
          container,
          definition,
          pluginId,
          policy: effectiveContentPolicy(definition, container),
          row,
        });
        canEdit = decision.allowed;
      }

      const isPublished = isContentBaseRowPublic({ ...row, hiddenAt: null });
      const canHide =
        isPublished &&
        (await canHideContentRecord(c, { model, pluginId, row }));
      const canDelete = await canDeleteContentRecord(c, {
        model,
        pluginId,
        row,
      });

      if (!isPublic && !canEdit && !canHide && !canDelete) return null;

      return {
        canDelete,
        canEdit,
        canHide,
        canReport:
          definition.reports.enabled &&
          isPublic &&
          (!isOwner || definition.reports.selfReport),
        id,
      };
    }),
  );

  const order = new Map(ids.map((id, index) => [contentIdKey(id), index]));

  return decided
    .filter(entry => entry !== null)
    .sort(
      (a, b) =>
        (order.get(contentIdKey(a.id)) ?? 0) -
        (order.get(contentIdKey(b.id)) ?? 0),
    );
};

/**
 * `GET /{publicApi.path}/permissions?ids=1,2,3`: what the current visitor may
 * do with each record, as `can*` flags. Mounted for content types with
 * `publicWrite`, `reports` or `visibility`. At most `CONTENT_PUBLIC_MAX_PAGE_SIZE`
 * distinct ids per request - `useContentPermissions` batches for you.
 * Personal, so never cached.
 */
export const contentPermissionsRoute = <
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
      method: "get",
      path: "/permissions",
      description: `What the current visitor may do with each listed ${name}: edit, delete, hide or report it`,
      request: {
        query: z.object({
          ids: z
            .string()
            .min(1)
            .max(64 * CONTENT_PUBLIC_MAX_PAGE_SIZE),
        }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(
                  z.object({
                    canDelete: z.boolean(),
                    canEdit: z.boolean(),
                    canHide: z.boolean(),
                    canReport: z.boolean(),
                    id: schemas.params.shape.id,
                  }),
                ),
              }),
            },
          },
          description: `One entry per ${name} the visitor may see, in the order asked. Others are left out`,
        },
        400: { description: `More than ${CONTENT_PUBLIC_MAX_PAGE_SIZE} ids` },
      },
    },
    handler: async c => {
      const ids = parseIds(definition, c.req.valid("query").ids);
      if (ids.length > CONTENT_PUBLIC_MAX_PAGE_SIZE) {
        return c.json(
          { error: `Ask for at most ${CONTENT_PUBLIC_MAX_PAGE_SIZE} ids.` },
          400,
        );
      }

      const items = await resolveContentViewerPermissions(
        c,
        model as unknown as ContentModel<AnyContentTypeDefinition>,
        { ids, pluginId },
      );

      return c.json({ items }, 200, { "Cache-Control": "private, no-store" });
    },
  });
};
