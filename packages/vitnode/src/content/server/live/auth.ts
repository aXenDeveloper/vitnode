import type { Context } from "hono";

import type {
  ContentLiveDocRef,
  ContentLiveRoomRef,
} from "@/content/live/protocol";
import type { RegisteredContentType } from "@/content/registry";

import { checkStaffPermissionOfUser } from "@/api/lib/check-staff-permission";
import { SessionAdminModel } from "@/api/models/session-admin";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentLiveRoom } from "@/content/live/protocol";
import { findContentLanguage } from "@/content/server/language-resolver";
import { findContentModel } from "@/content/server/model";

/** How long a socket keeps a positive authorization for one room. */
export const CONTENT_LIVE_AUTH_TTL_MS = 60_000;

/**
 * The field kind edited collaboratively. Compared as a string: the kind is
 * declared by the rich text field, not by the live layer.
 */
export const CONTENT_LIVE_DOCUMENT_FIELD_KIND = "richText";

/** What presence shows about an editor. */
export interface ContentLiveUser {
  avatarColor: null | string;
  id: number;
  name: string;
  nameCode: null | string;
}

export type ContentLiveAuthorization =
  | { code: "FORBIDDEN" | "NOT_FOUND"; ok: false }
  | {
      ok: true;
      user: ContentLiveUser;
      /** The record's version when it was checked, `null` if it has none. */
      version: null | number;
    };

/** An editorial content type registered on this install, or `undefined`. */
export const findLiveContentType = (
  c: Context,
  contentTypeId: string,
): RegisteredContentType | undefined =>
  c
    .get("core")
    .contentTypes.find(
      entry =>
        entry.definition.id === contentTypeId &&
        entry.definition.editorial.enabled,
    );

const versionOf = (row: object): null | number => {
  const version: unknown = Reflect.get(row, "version");

  return typeof version === "number" ? version : null;
};

/**
 * Whether the socket's AdminCP session may edit one record live.
 *
 * The socket only carries the user session on `c`, so the AdminCP session is
 * resolved here from its cookie (it has `path=/` and rides the upgrade
 * request). The permission check takes that user explicitly: `c.get("admin")`
 * is never written, so nothing leaks into the next message on the socket.
 */
export const authorizeContentLive = async (
  c: Context,
  room: ContentLiveRoomRef,
): Promise<ContentLiveAuthorization> => {
  const entry = findLiveContentType(c, room.contentTypeId);
  if (!entry) return { code: "NOT_FOUND", ok: false };

  const session = await new SessionAdminModel(c).getSession({ extend: false });
  if (!session) return { code: "FORBIDDEN", ok: false };

  const allowed = await checkStaffPermissionOfUser(c, session.user, {
    module: entry.definition.permissionModule,
    permission: CONTENT_PERMISSIONS.edit,
    plugin: entry.pluginId,
    type: "admin",
  });
  if (!allowed) return { code: "FORBIDDEN", ok: false };

  const model = findContentModel(
    c.get("core").contentModels,
    room.contentTypeId,
  );
  const row = model
    ? await model.model.service(c).findById(room.itemId)
    : undefined;
  if (!row) return { code: "NOT_FOUND", ok: false };

  const { avatarColor, id, name, nameCode } = session.user;

  return {
    ok: true,
    user: { avatarColor, id, name, nameCode },
    version: versionOf(row),
  };
};

/**
 * Remembers a positive authorization per socket and room for `ttlMs`, so a
 * keystroke does not cost a session lookup, while a revoked editor still loses
 * the room within a minute. Failures are never cached.
 */
export const createContentLiveAuthCache = ({
  authorize = authorizeContentLive,
  now = Date.now,
  ttlMs = CONTENT_LIVE_AUTH_TTL_MS,
}: {
  authorize?: (
    c: Context,
    room: ContentLiveRoomRef,
  ) => Promise<ContentLiveAuthorization>;
  now?: () => number;
  ttlMs?: number;
} = {}) => {
  type Remembered = Map<
    string,
    { expiresAt: number; result: ContentLiveAuthorization }
  >;
  const bySocket = new WeakMap<object, Remembered>();

  return {
    authorize: async (
      c: Context,
      socket: object,
      room: ContentLiveRoomRef,
    ): Promise<ContentLiveAuthorization> => {
      const key = contentLiveRoom(room);
      const rooms: Remembered = bySocket.get(socket) ?? new Map();
      bySocket.set(socket, rooms);

      const cached = rooms.get(key);
      if (cached && cached.expiresAt > now()) return cached.result;

      const result = await authorize(c, room);
      if (result.ok) rooms.set(key, { expiresAt: now() + ttlMs, result });
      else rooms.delete(key);

      return result;
    },
    forget: (socket: object, room: ContentLiveRoomRef): void => {
      bySocket.get(socket)?.delete(contentLiveRoom(room));
    },
  };
};

/**
 * Whether a document reference names a collaborative field of the content
 * type, in a locale that exists when the field is localized and with no
 * locale when it is not.
 */
export const isContentLiveDocValid = async (
  c: Context,
  doc: ContentLiveDocRef,
): Promise<boolean> => {
  const entry = findLiveContentType(c, doc.contentTypeId);
  if (!entry || !Object.hasOwn(entry.definition.fields, doc.field)) {
    return false;
  }

  const descriptor = entry.definition.fields[doc.field];
  const kind: string = descriptor.kind;
  if (kind !== CONTENT_LIVE_DOCUMENT_FIELD_KIND) return false;

  const localized =
    entry.definition.localization.enabled && descriptor.localized === true;
  if (!localized) return doc.locale === null;
  if (doc.locale === null) return false;

  // Exact, not case-insensitive: the locale is part of the document's room, so
  // "EN" and "en" would otherwise be two documents of one field.
  return (await findContentLanguage(c, doc.locale))?.locale === doc.locale;
};
