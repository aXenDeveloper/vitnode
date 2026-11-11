import { z } from "@hono/zod-openapi";
import { ilike, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { buildRoute } from "@/api/builders";
import { requireModerator } from "@/api/lib/moderation/access";
import { hasWarningPermission } from "@/api/lib/moderation/warnings/access";
import { core_users } from "@/database/users";
import { containsLikePattern } from "@/lib/api/like-pattern";
import { WARNING_PERMISSIONS } from "@/lib/moderation/warnings";

import { loadReportPeople } from "../lib/people";
import { json, reportPersonSchema } from "../moderation.schema";
import { commonResponses } from "../warnings.schema";

export const searchMembersRoute = buildRoute({
  route: {
    method: "get",
    path: "/members",
    description:
      "Find members by name for the ModCP member lookup (moderators who can warn or view warnings)",
    request: {
      query: z.object({ search: z.string().trim().min(1).max(100) }),
    },
    responses: {
      200: json(
        z.object({ items: z.array(reportPersonSchema) }),
        "Up to 10 members",
      ),
      401: commonResponses[401],
      403: { description: "Cannot warn or view warnings" },
    },
  },
  handler: async c => {
    const moderator = await requireModerator(c);
    if (
      !hasWarningPermission(moderator.set, WARNING_PERMISSIONS.view) &&
      !hasWarningPermission(moderator.set, WARNING_PERMISSIONS.warn)
    ) {
      throw new HTTPException(403, { message: "Forbidden" });
    }
    const { search } = c.req.valid("query");
    const pattern = containsLikePattern(search);
    const rows = await c
      .get("db")
      .select({ id: core_users.id })
      .from(core_users)
      .where(
        or(
          ilike(core_users.name, pattern),
          ilike(core_users.nameCode, pattern),
        ),
      )
      .orderBy(core_users.name)
      .limit(10);
    const people = await loadReportPeople(
      c,
      rows.map(row => row.id),
    );

    return c.json(
      {
        items: rows.flatMap(row => {
          const person = people.get(row.id);

          return person ? [person] : [];
        }),
      },
      200,
    );
  },
});
