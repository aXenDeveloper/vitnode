import type { Context } from "hono";

import type { ContentActor } from "../revisions";

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
