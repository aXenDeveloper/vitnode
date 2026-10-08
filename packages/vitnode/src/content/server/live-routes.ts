import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { ContentLiveRoomRef } from "../live/protocol";
import type { AnyContentTypeDefinition, ContentFieldMap } from "../types";
import type { ContentModel } from "./model";
import type { ContentDatabase } from "./service";

import { buildRoute } from "../../api/lib/route";
import { contentTypeName } from "../admin/labels";
import { CONTENT_PERMISSIONS } from "../const";
import {
  CONTENT_LIVE_CODES,
  zodContentDraftRejection,
  zodContentDrafts,
  zodContentDraftWrite,
  zodContentDraftWritten,
  zodContentFieldLocked,
  zodContentFieldLockList,
  zodContentFieldLockRequest,
  zodContentFieldLockResponse,
} from "../live/http";
import { partitionContentFields } from "../localization";
import { contentFieldUpdateSchema } from "../schemas";
import { findContentLanguage } from "./language-resolver";
import {
  acquireContentFieldLock,
  broadcastContentFieldLocks,
  findContentFieldLock,
  heldContentFieldLocks,
  listContentFieldLocks,
  readContentDrafts,
  releaseContentFieldLock,
  renewContentFieldLock,
  writeContentDraft,
} from "./live-store";
import { broadcastContentLive } from "./live/broadcast";
import { identifier, jsonBody, jsonResponse, readJson } from "./route-helpers";

/**
 * Field locks and the shared draft of one editorial content type: the HTTP
 * half of live editing. Every route needs `can_edit` - a lock or a draft is
 * the start of an edit, and a viewer has no business holding either.
 *
 * Mounted from `buildContentRoutes` for editorial content types only: a draft
 * is measured against the record's `version`, which only they have.
 */
export const buildContentLiveRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition } = model;
  const module = definition.permissionModule;
  const name = contentTypeName(definition.id);
  const permission = { module, permission: CONTENT_PERMISSIONS.edit };

  const { collectionFields, localizedFields, sharedFields } =
    partitionContentFields(definition.fields);
  /** What a `null`-locale draft may carry: the same fields `update` takes. */
  const sharedWritable: ContentFieldMap = {
    ...sharedFields,
    ...collectionFields,
  };
  const localized = definition.localization.enabled;

  const params = z.object({ id: z.coerce.number() });
  const notFound = { description: `${name} not found` };

  const db = (c: Context): ContentDatabase => c.get("db");

  const roomOf = (id: number): ContentLiveRoomRef => ({
    contentTypeId: definition.id,
    itemId: id,
  });

  /** The record, or a 404 - a lock on a record that is not there is nothing. */
  const findRecord = async (
    c: Context,
    id: number,
  ): Promise<Record<string, unknown>> => {
    const row = await model.service(c).findRowById(id);
    if (!row) {
      throw new HTTPException(404, { message: `${name} not found.` });
    }

    return row;
  };

  const editor = (c: Context): { id: number; name: string } => {
    const admin = c.get("admin") as null | {
      user?: { id?: unknown; name?: unknown };
    };
    const id = admin?.user?.id;
    if (typeof id !== "number") {
      throw new HTTPException(401, { message: "Sign in to the AdminCP." });
    }

    return {
      id,
      name: typeof admin?.user?.name === "string" ? admin.user.name : "",
    };
  };

  /**
   * The canonical spelling of a language the record can be written in, or a
   * 400. A disabled language is read-only, so it takes no lock and no draft.
   */
  const resolveLocale = async (c: Context, locale: string): Promise<string> => {
    const language = await findContentLanguage(c, locale);
    if (!language?.isEnabled) {
      throw new HTTPException(400, { message: "Unknown locale." });
    }

    return language.locale;
  };

  /**
   * Which language a field is locked or drafted in: `null` for a shared field,
   * a real language for a localized one. Anything else is a 400.
   */
  const scopeOf = async (
    c: Context,
    field: string,
    locale: null | string,
  ): Promise<null | string> => {
    const isLocalized = localizedFields[field] !== undefined;
    if (!isLocalized && sharedWritable[field] === undefined) {
      throw new HTTPException(400, { message: "Unknown field." });
    }
    if (!isLocalized) {
      if (locale !== null) {
        throw new HTTPException(400, {
          message: "A shared field takes no locale.",
        });
      }

      return null;
    }
    if (locale === null) {
      throw new HTTPException(400, {
        message: "A localized field needs a locale.",
      });
    }

    return await resolveLocale(c, locale);
  };

  const listLocks = buildRoute({
    pluginId,
    adminStaffPermission: permission,
    route: {
      method: "get",
      path: "/{id}/locks",
      description: `Field locks held on one ${name}`,
      request: { params },
      responses: {
        200: jsonResponse(zodContentFieldLockList, "Unexpired locks"),
        400: { description: "Invalid identifier" },
        404: notFound,
      },
    },
    handler: async c => {
      const id = identifier(c);
      await findRecord(c, id);

      return c.json(
        { locks: await listContentFieldLocks(db(c), roomOf(id)) },
        200,
      );
    },
  });

  const changeLock = buildRoute({
    pluginId,
    adminStaffPermission: permission,
    route: {
      method: "post",
      path: "/{id}/locks",
      description: `Acquire, renew or release a field lock on one ${name}`,
      request: { params, body: jsonBody(zodContentFieldLockRequest) },
      responses: {
        200: jsonResponse(zodContentFieldLockResponse, "The caller's lock"),
        400: { description: "Unknown field, or a locale that does not fit it" },
        404: notFound,
        409: jsonResponse(
          zodContentFieldLocked,
          "Someone else holds the lock, or the caller no longer does",
        ),
      },
    },
    handler: async c => {
      const id = identifier(c);
      const body = await readJson(c, zodContentFieldLockRequest);
      const user = editor(c);
      const locale = await scopeOf(c, body.field, body.locale);
      await findRecord(c, id);

      const room = roomOf(id);
      const key = { ...room, field: body.field, locale };

      if (body.action === "release") {
        if (await releaseContentFieldLock(db(c), key, user.id)) {
          await broadcastContentFieldLocks(db(c), room);
        }

        return c.json({ lock: null }, 200);
      }

      const taken =
        body.action === "acquire"
          ? await acquireContentFieldLock(db(c), key, user.id)
          : await renewContentFieldLock(db(c), key, user.id);
      const lock = await findContentFieldLock(db(c), key);

      if (!taken || lock?.user.id !== user.id) {
        return c.json({ code: CONTENT_LIVE_CODES.locked, lock }, 409);
      }

      await broadcastContentFieldLocks(db(c), room);

      return c.json({ lock }, 200);
    },
  });

  const readDraft = buildRoute({
    pluginId,
    adminStaffPermission: permission,
    route: {
      method: "get",
      path: "/{id}/draft",
      description: `The shared working copy of one ${name}`,
      request: { params },
      responses: {
        200: jsonResponse(
          zodContentDrafts,
          "The shared and per-language drafts",
        ),
        400: { description: "Invalid identifier" },
        404: notFound,
      },
    },
    handler: async c => {
      const id = identifier(c);
      await findRecord(c, id);

      return c.json(await readContentDrafts(db(c), roomOf(id)), 200);
    },
  });

  const writeDraft = buildRoute({
    pluginId,
    adminStaffPermission: permission,
    route: {
      method: "put",
      path: "/{id}/draft",
      description: `Autosave fields of one ${name} into its shared draft`,
      request: { params, body: jsonBody(zodContentDraftWrite) },
      responses: {
        200: jsonResponse(zodContentDraftWritten, "Draft saved"),
        400: jsonResponse(
          zodContentDraftRejection,
          "A field outside the locale's scope, or a value the field refuses",
        ),
        404: notFound,
        409: jsonResponse(
          zodContentDraftRejection,
          "The caller holds no lock on some of the fields",
        ),
      },
    },
    handler: async c => {
      const id = identifier(c);
      const body = await readJson(c, zodContentDraftWrite);
      const user = editor(c);
      const names = Object.keys(body.values);

      // Scope first: a localized field only with a locale, a shared field only
      // without one - the two live in different drafts.
      const scope = body.locale === null ? sharedWritable : localizedFields;
      const outOfScope = names.filter(field => scope[field] === undefined);
      if (outOfScope.length > 0 || (body.locale !== null && !localized)) {
        return c.json(
          {
            code: CONTENT_LIVE_CODES.draftScope,
            fields: outOfScope.length > 0 ? outOfScope : names,
          },
          400,
        );
      }

      const locale =
        body.locale === null ? null : await resolveLocale(c, body.locale);
      const record = await findRecord(c, id);
      const room = roomOf(id);

      const held = await heldContentFieldLocks(db(c), {
        locale,
        names,
        room,
        userId: user.id,
      });
      const unlocked = names.filter(field => !held.has(field));
      if (unlocked.length > 0) {
        return c.json(
          { code: CONTENT_LIVE_CODES.notLocked, fields: unlocked },
          409,
        );
      }

      const values: Record<string, unknown> = {};
      const invalid: string[] = [];
      for (const field of names) {
        const parsed = contentFieldUpdateSchema(scope, field)?.safeParse(
          body.values[field],
        );
        if (parsed?.success) values[field] = parsed.data;
        else invalid.push(field);
      }
      if (invalid.length > 0) {
        return c.json(
          { code: CONTENT_LIVE_CODES.draftInvalid, fields: invalid },
          400,
        );
      }

      // Measured against what the draft was written on, so the cleanup job can
      // tell a draft the record has since moved past from live work.
      const baseVersion =
        locale === null
          ? typeof record.version === "number"
            ? record.version
            : 0
          : ((await model.translationService?.(c).findByLocale(id, locale))
              ?.version ?? 0);

      const updatedAt = await writeContentDraft(db(c), {
        baseVersion,
        locale,
        room,
        userId: user.id,
        values,
      });

      broadcastContentLive(room, {
        by: user,
        locale,
        room,
        type: "draft",
        updatedAt: updatedAt.toISOString(),
        values,
      });

      return c.json({ updatedAt: updatedAt.toISOString() }, 200);
    },
  });

  return [listLocks, changeLock, readDraft, writeDraft];
};
