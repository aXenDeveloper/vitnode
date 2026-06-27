import { z } from "@hono/zod-openapi";

import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "@/api/lib/with-pagination";

// Shared between the moderators and admins staff lists — both read from a
// permissions table that links either a role or a user to a staff group.
export const staffListAdminQuery = zodPaginationQuery.extend({
  order: z.enum(["asc", "desc"]).optional(),
  orderBy: z.enum(["id", "createdAt", "updatedAt"]).optional(),
});

// A role reference resolved for the `RoleFormat` component (it picks the active
// locale from the translated names on the frontend).
const staffRoleSchema = z.object({
  id: z.number(),
  color: z.string().nullable(),
  name: z.array(
    z.object({
      name: z.string(),
      languageCode: z.string(),
    }),
  ),
});

export const staffListAdminSchema = z.object({
  edges: z.array(
    z.object({
      id: z.number(),
      createdAt: z.date(),
      updatedAt: z.date(),
      // A staff entry grants permissions to a whole role...
      role: staffRoleSchema.nullable(),
      // ...or to a single user (rendered with their own role formatting).
      user: z
        .object({
          id: z.number(),
          name: z.string(),
          nameCode: z.string(),
          avatarColor: z.string(),
          role: staffRoleSchema,
        })
        .nullable(),
    }),
  ),
  pageInfo: zodPaginationPageInfo,
});
