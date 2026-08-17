import type { Context } from "hono";

import type { ContentActor } from "../revisions";

/**
 * Who a request is acting as, for the revision it is about to write.
 *
 * Built by the *route*, not by the service, because only the route knows which
 * gate it sits behind. An admin route has already been through
 * `globalAdminMiddleware` and `assertStaffPermission`, so `c.get("admin")` is
 * populated and the mutation is `staff`. A hand-written route that a signed-in
 * member reached is `api`. Anything with no user at all - a cron request, the
 * queue worker - is `system`, and gets a `null` user id rather than a fake one.
 */
export const resolveContentActor = (c: Context): ContentActor => {
  const admin = c.get("admin") as null | { user?: { id?: unknown } };
  const adminId = admin?.user?.id;
  if (typeof adminId === "number") return { type: "staff", userId: adminId };

  const user = c.get("user") as null | { id?: unknown };
  if (typeof user?.id === "number") return { type: "api", userId: user.id };

  return { type: "system", userId: null };
};

/** The actor a background task runs as. Spelled out so no call site invents one. */
export const CONTENT_SYSTEM_ACTOR: ContentActor = {
  type: "system",
  userId: null,
};
