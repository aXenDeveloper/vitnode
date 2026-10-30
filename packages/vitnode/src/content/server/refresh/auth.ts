import type { Context } from "hono";

import type { ContentRefreshScope } from "@/content/live/refresh";

import { checkStaffPermissionOfUser } from "@/api/lib/check-staff-permission";
import { SessionModel } from "@/api/models/session";
import { SessionAdminModel } from "@/api/models/session-admin";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentRefreshRoom } from "@/content/live/refresh";

import { resolveContentThreadRoot } from "../thread-access";

export type ContentRefreshAuthorization =
  | { code: "FORBIDDEN" | "NOT_FOUND"; ok: false }
  | { ok: true };

/**
 * Whether the connection behind `c` may follow `scope`, by the same rules as
 * the HTTP route it mirrors:
 *
 * - `admin`: an AdminCP session (read fresh, so a signed-out or expired one
 *   fails) whose user holds the content type's `can_view` - the permission
 *   the generated `GET /` list route requires.
 * - `thread`: `resolveContentThreadRoot`, the rule behind `GET /thread`. A
 *   guest passes for a public root; a connection opened signed in fails once
 *   that session is gone.
 */
export const authorizeContentRefresh = async (
  c: Context,
  scope: ContentRefreshScope,
): Promise<ContentRefreshAuthorization> => {
  const entry = (c.get("core")?.contentTypes ?? []).find(
    candidate => candidate.definition.id === scope.contentTypeId,
  );
  if (!entry) return { code: "NOT_FOUND", ok: false };

  if (scope.kind === "thread") {
    const { definition } = entry;
    if (!definition.thread.enabled || !definition.publicApi.enabled) {
      return { code: "NOT_FOUND", ok: false };
    }

    // The connection keeps the user it was opened with. Signed out since, it
    // follows nothing until the client reconnects as whoever it is now.
    const user = c.get("user");
    if (user && (await new SessionModel(c).getUser())?.id !== user.id) {
      return { code: "FORBIDDEN", ok: false };
    }

    return (await resolveContentThreadRoot(c, definition, scope.rootId))
      ? { ok: true }
      : { code: "NOT_FOUND", ok: false };
  }

  const session = await new SessionAdminModel(c).getSession({ extend: false });
  if (!session) return { code: "FORBIDDEN", ok: false };

  const allowed = await checkStaffPermissionOfUser(c, session.user, {
    module: entry.definition.permissionModule,
    permission: CONTENT_PERMISSIONS.view,
    plugin: entry.pluginId,
    type: "admin",
  });

  return allowed ? { ok: true } : { code: "FORBIDDEN", ok: false };
};

/**
 * Connections that are sure to get the same answer for `scope`, so a re-check
 * of a busy room asks once per group: a thread's answer depends only on who is
 * signed in. `null` for an admin scope, which reads each connection's own
 * AdminCP session.
 */
export const contentRefreshShareKey = (
  c: Context,
  scope: ContentRefreshScope,
): null | string => {
  if (scope.kind === "admin") return null;

  return `${contentRefreshRoom(scope)}|${c.get("user")?.id ?? "guest"}`;
};
