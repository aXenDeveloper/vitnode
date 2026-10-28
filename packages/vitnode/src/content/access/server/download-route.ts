import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../../types";
import type { AnyContentModel, ContentModel } from "../../server/model";

import { attachStoredFile } from "../../../api/lib/file-download";
import { buildRoute } from "../../../api/lib/route";
import { core_files } from "../../../database/files";
import { contentTypeName } from "../../admin/labels";
import { parseContentId } from "../../ids";
import { canViewHiddenContentRecord } from "../../server/hidden-access";
import {
  contentPublicReadCondition,
  publicationColumns,
} from "../../server/publication";
import { CONTENT_ACCESS_REQUIRED_CODE } from "../const";
import { canAccessContentRecord } from "./decide";
import { contentRecordHasFile } from "./files";
import { CONTENT_ACCESS_PRIVATE_HEADERS, zodContentAccessRequired } from "./http";
import { contentAccessCondition } from "./source";

/**
 * `GET /{publicApi.path}/{id}/files/{fileId}`: one file of one record, for a
 * reader the record's access rules let in - images with `read`, anything else
 * with `downloadAttachments` as well. The file has to belong to the record
 * (a file field, or a rich-text document of it), whatever id the URL names.
 * Private files leave storage only through here. Plugins do not call this
 * directly; `buildContentPublicModule` mounts it.
 */
export const contentFileDownloadRoute = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition } = model;
  const name = contentTypeName(definition.id);
  const accessModel = model as unknown as AnyContentModel;

  return buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/{id}/files/{fileId}",
      description: `Download one file of a ${name}, when the reader may read it - and, for anything but an image, download its attachments`,
      request: {
        params: z.object({
          fileId: z.coerce.number().int().positive(),
          id: z.string().min(1).max(64),
        }),
      },
      responses: {
        200: {
          content: {
            "application/octet-stream": {
              schema: z.string().openapi({ format: "binary", type: "string" }),
            },
          },
          description: "The file",
        },
        403: {
          content: {
            "application/json": { schema: zodContentAccessRequired },
          },
          description:
            "The reader may read the record but not download its attachments",
        },
        404: {
          description:
            "No such record, no such file, or nothing the reader may read",
        },
      },
    },
    handler: async c => {
      const { fileId, id } = c.req.valid("param");
      const itemId = parseContentId(definition.idStrategy, id);
      const missing = () =>
        c.json({ message: "File not found." }, 404, CONTENT_ACCESS_PRIVATE_HEADERS);
      if (itemId === null) return missing();

      // Published and readable under the rules of its scopes right now - any
      // language, so a file of a record without a default translation still
      // resolves. A hidden record only for those who may see it.
      const columns = model.columns as Record<string, PgColumn>;
      const table: PgTable = model.table;
      const published = publicationColumns(definition, columns);
      const access = await contentAccessCondition(c, accessModel, "read");
      const [visible] = await c
        .get("db")
        .select({ id: columns.id })
        .from(table)
        .where(
          and(
            eq(columns.id, itemId),
            contentPublicReadCondition(published, {}),
            access,
          ),
        )
        .limit(1);
      const readable =
        visible !== undefined ||
        ((await canViewHiddenContentRecord(c, {
          contentTypeId: definition.id,
          itemId,
        })) &&
          (await canAccessContentRecord(c, {
            action: "read",
            id: itemId,
            model: accessModel,
          })));
      if (!readable) return missing();

      if (!(await contentRecordHasFile(c, accessModel, itemId, fileId))) {
        return missing();
      }

      const [file] = await c
        .get("db")
        .select({
          key: core_files.key,
          mimeType: core_files.mimeType,
          name: core_files.name,
          visibility: core_files.visibility,
        })
        .from(core_files)
        .where(eq(core_files.id, fileId))
        .limit(1);
      if (!file || !c.get("core").storage?.adapter) return missing();

      const isImage = file.mimeType?.startsWith("image/") === true;
      if (
        !isImage &&
        !(await canAccessContentRecord(c, {
          action: "downloadAttachments",
          id: itemId,
          model: accessModel,
        }))
      ) {
        return c.json(
          { accessRequired: true as const, code: CONTENT_ACCESS_REQUIRED_CODE },
          403,
          CONTENT_ACCESS_PRIVATE_HEADERS,
        );
      }

      return (
        (await attachStoredFile(c, file, { inline: isImage })) ?? missing()
      );
    },
  });
};
