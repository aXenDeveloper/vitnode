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
export const staffRoleSchema = z.object({
  id: z.number(),
  color: z.string().nullable(),
  name: z.array(
    z.object({
      name: z.string(),
      languageCode: z.string(),
    }),
  ),
});

// A single resolved staff entry — the shape returned by `resolveStaffEdges`.
export const staffEntrySchema = z.object({
  id: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  unrestricted: z.boolean(),
  protected: z.boolean(),
  self: z.boolean(),
  role: staffRoleSchema.nullable(),
  user: z
    .object({
      id: z.number(),
      name: z.string(),
      nameCode: z.string(),
      avatarColor: z.string(),
      role: staffRoleSchema,
    })
    .nullable(),
});

export const staffListAdminSchema = z.object({
  edges: z.array(staffEntrySchema),
  pageInfo: zodPaginationPageInfo,
});

export const permissionsStaffArgsSchema = z.object({
  plugin: z.string(),
  module: z.string(),
  permission: z.string(),
});

export const staffTypeSchema = z.enum(["admin", "moderator"]);
