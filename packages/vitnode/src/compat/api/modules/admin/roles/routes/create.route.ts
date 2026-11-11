/**
 * Package entry for
 * `@vitnode/core/api/modules/admin/roles/routes/create.route`. Its own
 * exports are served unchanged; the exports the API file migration moved to
 * other modules are re-exported here, deprecated, so existing deep imports
 * keep working. Source:
 * `src/api/modules/admin/roles/routes/create.route.ts`.
 */

/** @deprecated Import from `@vitnode/core/api/modules/admin/roles/roles.schema`. */
export {
  ROLE_IMAGE_SIZE_MAX_KB,
  zodRoleEditOwnContentMinutesSchema,
  zodRoleImageSizeSchema,
  zodRoleNameSchema,
  zodRolePrefixSchema,
  zodRoleStorageSchema,
} from "@/api/modules/admin/roles/roles.schema";
export {
  createRoleAdminRoute,
  zodCreateRoleAdminSchema,
} from "@/api/modules/admin/roles/routes/create.route";
