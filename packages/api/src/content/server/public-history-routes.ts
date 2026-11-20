import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel, ContentModel } from "./model";

import { core_content_revisions } from "../../database/content";
import { loadPublicPeople } from "../../lib/public-people";
import { buildRoute } from "../../lib/route";
import { canAccessContentRecord } from "../access/server/decide";
import { contentTypeName } from "../admin/labels";
import { contentIdKey } from "../ids";
import { zodContentPublicPerson } from "../public-person";
import { richTextToPlainText } from "../rich-text/plain-text";
import { canViewHiddenContentRecord } from "./hidden-access";
import { contentIdentifier } from "./route-helpers";
import { resolveContentThreadRoot } from "./thread-access";
import { isContentBaseRowPublic } from "./visibility";

const HISTORY_OPERATIONS = ["create", "update"] as const;
const HISTORY_LIMIT = 50;

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

const revisionScope = (
  definition: AnyContentTypeDefinition,
  ids: readonly ContentId[],
) =>
  and(
    eq(core_content_revisions.contentTypeId, definition.id),
    inArray(core_content_revisions.itemId, ids.map(contentIdKey)),
    isNull(core_content_revisions.languageId),
  );

export const loadContentEditCounts = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  ids: readonly ContentId[],
): Promise<Map<string, number>> => {
  if (!definition.editorial.enabled || ids.length === 0) {
    return new Map();
  }

  const rows = await c
    .get("db")
    .select({ itemId: core_content_revisions.itemId, total: count() })
    .from(core_content_revisions)
    .where(
      and(
        revisionScope(definition, ids),
        eq(core_content_revisions.operation, "update"),
      ),
    )
    .groupBy(core_content_revisions.itemId);

  return new Map(rows.map(row => [row.itemId, row.total]));
};

const plainTextOf = (value: unknown): null | string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "type" in value) {
    return richTextToPlainText(
      value as Parameters<typeof richTextToPlainText>[0],
    );
  }

  return null;
};

const snapshotFieldsOf = (snapshot: unknown): Record<string, unknown> =>
  snapshot && typeof snapshot === "object" && "fields" in snapshot
    ? ((snapshot as { fields: Record<string, unknown> }).fields ?? {})
    : {};

export const contentPublicHistoryRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const anyModel = model as unknown as AnyContentModel;
  const name = contentTypeName(definition.id);
  const textFields = definition.publicApi.fields.filter(field => {
    const kind = definition.fields[field]?.kind;

    return kind === "richText" || kind === "text";
  });

  const readableRecord = async (c: Context, id: ContentId) => {
    const [row] = (await c
      .get("db")
      .select()
      .from(anyModel.table)
      .where(eq(anyModel.columns.id as never, id))
      .limit(1)) as Record<string, unknown>[];
    if (!row) return null;
    if (
      !(await canAccessContentRecord(c, {
        action: "read",
        id,
        model: anyModel,
      }))
    ) {
      return null;
    }

    const visible =
      isContentBaseRowPublic(row) ||
      (isContentBaseRowPublic({ ...row, hiddenAt: null }) &&
        (await canViewHiddenContentRecord(c, {
          contentTypeId: definition.id,
          itemId: id,
        })));
    if (!visible) return null;

    const root = row[definition.thread.rootField];
    if (root === null || root === undefined) return null;

    return (await resolveContentThreadRoot(c, definition, root)) ? row : null;
  };

  const notFound = () =>
    new HTTPException(404, { message: `${name} not found.` });

  const requireMember = (c: Context) => {
    if (!c.get("user")) {
      throw new HTTPException(401, { message: "Sign in first." });
    }
  };

  const zodEdit = z.object({
    actor: zodContentPublicPerson.nullable(),
    createdAt: z.string(),
    id: z.number().int(),
    operation: z.enum(HISTORY_OPERATIONS),
  });

  const history = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/{id}/history",
      description: `Who wrote and who edited one ${name}, newest first. Signed-in members only, for a ${name} they can see`,
      request: { params: schemas.params },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                complete: z.boolean(),
                edits: z.array(zodEdit),
              }),
            },
          },
          description: `The ${name}'s creation and its edits, newest first`,
        },
        401: { description: "Not signed in" },
        404: { description: `The ${name} does not exist or is not readable` },
      },
    },
    handler: async c => {
      requireMember(c);
      const id = contentIdentifier(c, definition);
      if (!(await readableRecord(c, id))) throw notFound();

      const rows = await c
        .get("db")
        .select({
          actorUserId: core_content_revisions.actorUserId,
          createdAt: core_content_revisions.createdAt,
          id: core_content_revisions.id,
          operation: core_content_revisions.operation,
        })
        .from(core_content_revisions)
        .where(
          and(
            revisionScope(definition, [id]),
            inArray(core_content_revisions.operation, [...HISTORY_OPERATIONS]),
          ),
        )
        .orderBy(desc(core_content_revisions.version))
        .limit(HISTORY_LIMIT);

      const people = await loadPublicPeople(
        c,
        rows.map(row => row.actorUserId),
      );

      return c.json(
        {
          complete: rows.some(row => row.operation === "create"),
          edits: rows.map(row => ({
            actor:
              row.actorUserId === null
                ? null
                : (people.get(row.actorUserId) ?? null),
            createdAt: new Date(row.createdAt).toISOString(),
            id: row.id,
            operation: row.operation as (typeof HISTORY_OPERATIONS)[number],
          })),
        },
        200,
        PRIVATE_HEADERS,
      );
    },
  });

  const historyEntry = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/{id}/history/{revisionId}",
      description: `The text of one ${name} before and after one edit. Signed-in members only`,
      request: {
        params: schemas.params.extend({
          revisionId: z.coerce.number().int().positive(),
        }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                actor: zodContentPublicPerson.nullable(),
                changes: z.array(
                  z.object({
                    after: z.string().nullable(),
                    before: z.string().nullable(),
                    field: z.string(),
                  }),
                ),
                createdAt: z.string(),
                operation: z.enum(HISTORY_OPERATIONS),
              }),
            },
          },
          description: "The changed text fields, before and after",
        },
        401: { description: "Not signed in" },
        404: { description: "The edit does not exist or is not readable" },
      },
    },
    handler: async c => {
      requireMember(c);
      const id = contentIdentifier(c, definition);
      const { revisionId } = c.req.valid("param") as { revisionId: number };
      if (!(await readableRecord(c, id))) throw notFound();

      const [revision] = await c
        .get("db")
        .select({
          actorUserId: core_content_revisions.actorUserId,
          createdAt: core_content_revisions.createdAt,
          operation: core_content_revisions.operation,
          snapshot: core_content_revisions.snapshot,
          version: core_content_revisions.version,
        })
        .from(core_content_revisions)
        .where(
          and(
            revisionScope(definition, [id]),
            eq(core_content_revisions.id, revisionId),
            inArray(core_content_revisions.operation, [...HISTORY_OPERATIONS]),
          ),
        )
        .limit(1);
      if (!revision) throw notFound();

      const [previous] =
        revision.operation === "create"
          ? []
          : await c
              .get("db")
              .select({ snapshot: core_content_revisions.snapshot })
              .from(core_content_revisions)
              .where(
                and(
                  revisionScope(definition, [id]),
                  lt(core_content_revisions.version, revision.version),
                ),
              )
              .orderBy(desc(core_content_revisions.version))
              .limit(1);

      const afterFields = snapshotFieldsOf(revision.snapshot);
      const beforeFields = previous ? snapshotFieldsOf(previous.snapshot) : {};
      const changes = textFields.flatMap(field => {
        const after = plainTextOf(afterFields[field]);
        const before = previous ? plainTextOf(beforeFields[field]) : null;
        if (after === null && before === null) return [];
        if (revision.operation === "update" && after === before) return [];

        return [{ after, before, field }];
      });

      const people = await loadPublicPeople(c, [revision.actorUserId]);

      return c.json(
        {
          actor:
            revision.actorUserId === null
              ? null
              : (people.get(revision.actorUserId) ?? null),
          changes,
          createdAt: new Date(revision.createdAt).toISOString(),
          operation: revision.operation as (typeof HISTORY_OPERATIONS)[number],
        },
        200,
        PRIVATE_HEADERS,
      );
    },
  });

  return [history, historyEntry];
};
