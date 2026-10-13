import type { Context, MiddlewareHandler } from "hono";

import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import type { ContentPublicWriteRejection } from "../conflicts";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";

import { buildRoute } from "../../api/lib/route";
import { contentTypeName } from "../admin/labels";
import {
  zodContentConflict,
  zodContentPublicWriteRejection,
} from "../conflicts";
import {
  CONTENT_PUBLIC_WRITE_CODES,
  CONTENT_PUBLIC_WRITE_ISSUE_CODES,
} from "../const";
import { assertRelationTargetIsPublic } from "../define-public-write";
import {
  ContentPublicWriteDenied,
  ContentPublicWriteInputError,
} from "../errors";
import { rethrowAsHttpError } from "./http-errors";
import { resolveContentPublicWriteActor } from "./public-write-authorization";
import { createContentPublicWriteService } from "./public-write-service";
import { contentIdentifier, readJson } from "./route-helpers";

const STATUS_OF: Record<ContentPublicWriteDenied["reason"], 401 | 403 | 404> = {
  forbidden: 403,
  notFound: 404,
  unauthenticated: 401,
};

const CODE_OF: Record<
  ContentPublicWriteDenied["reason"],
  ContentPublicWriteRejection["code"]
> = {
  forbidden: CONTENT_PUBLIC_WRITE_CODES.forbidden,
  notFound: CONTENT_PUBLIC_WRITE_CODES.notFound,
  unauthenticated: CONTENT_PUBLIC_WRITE_CODES.unauthenticated,
};

const reject = (
  status: 400 | 401 | 403 | 404,
  body: ContentPublicWriteRejection,
): HTTPException =>
  new HTTPException(status, { res: Response.json(body, { status }) });

const issuesOf = (error: ZodError): ContentPublicWriteRejection["issues"] =>
  error.issues.flatMap((issue): ContentPublicWriteRejection["issues"] => {
    const [envelope, field] = issue.path;

    if (
      issue.code === "unrecognized_keys" &&
      envelope === "values" &&
      field === undefined
    ) {
      return issue.keys.map(key => ({
        code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.notWritable,
        field: key,
        message: "This field cannot be written.",
      }));
    }

    return [
      {
        code: issue.code,
        field:
          envelope === "values" && typeof field === "string" ? field : null,
        message: issue.message,
      },
    ];
  });

const toHttpError = (
  error: unknown,
  {
    action,
    contentTypeId,
    itemId,
  }: {
    action: "create" | "update";
    contentTypeId: string;
    itemId?: ContentId;
  },
): never => {
  if (error instanceof HTTPException) throw error;

  if (error instanceof ContentPublicWriteDenied) {
    throw reject(STATUS_OF[error.reason], {
      code: CODE_OF[error.reason],
      contentTypeId,
      issues: [],
    });
  }

  if (error instanceof ZodError) {
    throw reject(400, {
      code: CONTENT_PUBLIC_WRITE_CODES.invalidInput,
      contentTypeId,
      issues: issuesOf(error),
    });
  }

  if (error instanceof ContentPublicWriteInputError) {
    throw reject(400, {
      code: CONTENT_PUBLIC_WRITE_CODES.invalidInput,
      contentTypeId,
      issues: [
        {
          code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.unavailable,
          field: error.field,
          message: error.detail,
        },
      ],
    });
  }

  return rethrowAsHttpError(error, {
    action,
    contentTypeId,
    itemId,
    structured: true,
  });
};

const guard =
  (
    definition: AnyContentTypeDefinition,
    schema?: { safeParse: (value: unknown) => { error?: ZodError } },
  ): MiddlewareHandler =>
  async (c, next) => {
    if (!resolveContentPublicWriteActor(c)) {
      toHttpError(
        new ContentPublicWriteDenied({
          contentTypeId: definition.id,
          reason: "unauthenticated",
        }),
        { action: "create", contentTypeId: definition.id },
      );
    }

    if (schema) {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        throw reject(400, {
          code: CONTENT_PUBLIC_WRITE_CODES.invalidInput,
          contentTypeId: definition.id,
          issues: [
            {
              code: CONTENT_PUBLIC_WRITE_ISSUE_CODES.invalidJson,
              field: null,
              message: "The body must be JSON.",
            },
          ],
        });
      }

      const { error } = schema.safeParse(body);
      if (error) {
        toHttpError(error, {
          action: "create",
          contentTypeId: definition.id,
        });
      }
    }

    await next();
  };

const rejection = (description: string) => ({
  content: {
    "application/json": { schema: zodContentPublicWriteRejection },
  },
  description,
});

export const buildContentPublicWriteRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const name = contentTypeName(definition.id);
  const editorial = definition.editorial.enabled;
  const writeSchemas = schemas.publicWrite;

  for (const field of new Set([
    ...definition.publicWrite.create.fields,
    ...definition.publicWrite.update.fields,
  ])) {
    assertRelationTargetIsPublic(
      definition.id,
      "publicWrite",
      field,
      definition.fields[field],
      { deferred: false },
    );
  }

  const service = (c: Context) =>
    createContentPublicWriteService({ c, model, pluginId });

  const conflict = {
    content: { "application/json": { schema: zodContentConflict } },
    description: editorial
      ? "A unique value is taken, or the record moved since `expectedVersion`"
      : "A unique value is taken",
  };

  const create = buildRoute({
    pluginId,
    route: {
      method: "post",
      path: "/",
      description: `Create a ${name} as the signed-in user`,
      withCaptcha: definition.publicWrite.create.captcha,
      middleware: [guard(definition, writeSchemas.createBody)],
      request: {
        body: {
          content: {
            "application/json": { schema: writeSchemas.createBody },
          },
        },
      },
      responses: {
        201: {
          content: { "application/json": { schema: writeSchemas.record } },
          description: `${name} created`,
        },
        400: rejection(
          "Invalid input, or a relation target that is not available",
        ),
        401: rejection("Not signed in"),
        409: conflict,
      },
    },
    handler: async c => {
      try {
        const { values } = await readJson(c, writeSchemas.createBody);
        const record = await service(c).create(values);

        return c.json(record, 201);
      } catch (error) {
        return toHttpError(error, {
          action: "create",
          contentTypeId: definition.id,
        });
      }
    },
  });

  const editable = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/{id}/edit",
      description: `Read one ${name} for editing, drafts included`,
      middleware: [guard(definition)],
      request: { params: schemas.params },
      responses: {
        200: {
          content: { "application/json": { schema: writeSchemas.record } },
          description: `${name} as its owner or a moderator edits it`,
        },
        401: rejection("Not signed in"),
        403: rejection("Not the owner, and not a moderator"),
        404: rejection(`${name} not found, or not visible to you`),
      },
    },
    handler: async c => {
      const id = contentIdentifier(c, definition);

      try {
        const record = await service(c).findEditable(id);

        return c.json(record, 200, { "Cache-Control": "private, no-store" });
      } catch (error) {
        return toHttpError(error, {
          action: "update",
          contentTypeId: definition.id,
          itemId: id,
        });
      }
    },
  });

  const update = buildRoute({
    pluginId,
    route: {
      method: "patch",
      path: "/{id}",
      description: `Edit a ${name} you own, or any ${name} as a moderator`,
      middleware: [guard(definition, writeSchemas.updateBody)],
      request: {
        params: schemas.params,
        body: {
          content: {
            "application/json": { schema: writeSchemas.updateBody },
          },
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: writeSchemas.record } },
          description: `${name} updated`,
        },
        400: rejection(
          "Invalid input, or a relation target that is not available",
        ),
        401: rejection("Not signed in"),
        403: rejection("Not the owner, and not a moderator"),
        404: rejection(`${name} not found, or not visible to you`),
        409: conflict,
      },
    },
    handler: async c => {
      const id = contentIdentifier(c, definition);

      try {
        const body = await readJson(c, writeSchemas.updateBody);
        const record = await service(c).update(id, body);

        return c.json(record, 200);
      } catch (error) {
        return toHttpError(error, {
          action: "update",
          contentTypeId: definition.id,
          itemId: id,
        });
      }
    },
  });

  return { create, editable, update };
};

type PublicWriteRoutes<
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
> = ReturnType<typeof buildContentPublicWriteRoutes<TDefinition, P>>;

export type ContentPublicWriteRoutesOf<
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
> =
  | (TDefinition extends { publicWrite: { create: { enabled: true } } }
      ? PublicWriteRoutes<TDefinition, P>["create"]
      : never)
  | (TDefinition extends { publicWrite: { update: { enabled: true } } }
      ?
          | PublicWriteRoutes<TDefinition, P>["editable"]
          | PublicWriteRoutes<TDefinition, P>["update"]
      : never);

export const contentPublicWriteRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
): ContentPublicWriteRoutesOf<TDefinition, P>[] => {
  const { publicWrite } = model.definition;
  if (!publicWrite.enabled) return [];

  const routes = buildContentPublicWriteRoutes(model, { pluginId });

  return [
    ...(publicWrite.create.enabled ? [routes.create] : []),
    ...(publicWrite.update.enabled ? [routes.editable, routes.update] : []),
  ] as ContentPublicWriteRoutesOf<TDefinition, P>[];
};
