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

const CONTENT_LIVE_AUTH_TTL_MS = 60_000;

const CONTENT_LIVE_DOCUMENT_FIELD_KIND = "richText";

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
      version: null | number;
    };

const findLiveContentType = (
  c: Context,
  contentTypeId: string,
): RegisteredContentType | undefined =>
  c
    .get("core")
    .contentTypes.find(
      entry =>
        entry.definition.id === contentTypeId &&
        entry.definition.liveEditing.enabled,
    );

const versionOf = (row: object): null | number => {
  const version: unknown = Reflect.get(row, "version");

  return typeof version === "number" ? version : null;
};

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

  return (await findContentLanguage(c, doc.locale))?.locale === doc.locale;
};
