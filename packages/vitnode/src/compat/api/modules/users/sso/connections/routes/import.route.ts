/**
 * @deprecated
 * `@vitnode/core/api/modules/users/sso/connections/routes/import.route` was
 * split by the API file migration. This compatibility entry only re-exports
 * its former exports from their new modules, named on each export below;
 * import from those instead.
 */

/** @deprecated Import from `@vitnode/core/api/modules/users/sso/connections/routes/apply-import.route`. */
export {
  ssoApplyImportRoute,
  zodSsoApplyImportSchema,
} from "@/api/modules/users/sso/connections/routes/apply-import.route";
/** @deprecated Import from `@vitnode/core/api/modules/users/sso/connections/routes/discard-import.route`. */
export { ssoDiscardImportRoute } from "@/api/modules/users/sso/connections/routes/discard-import.route";
/** @deprecated Import from `@vitnode/core/api/modules/users/sso/connections/routes/preview-import.route`. */
export { ssoImportPreviewRoute } from "@/api/modules/users/sso/connections/routes/preview-import.route";
