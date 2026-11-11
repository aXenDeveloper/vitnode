/**
 * @deprecated
 * `@vitnode/core/api/modules/admin/plugins/routes/updates.schema` was split
 * by the API file migration. This compatibility entry only re-exports its
 * former exports from their new modules, named on each export below; import
 * from those instead.
 */

/** @deprecated Import from `@vitnode/core/api/modules/admin/plugins/lib/serialize-update`. */
export {
  iso,
  serializeComponentUpdate,
} from "@/api/modules/admin/plugins/lib/serialize-update";
/** @deprecated Import from `@vitnode/core/api/modules/admin/plugins/updates.schema`. */
export {
  componentUpdateSchema,
  updatesOverviewSchema,
  updatesSummarySchema,
} from "@/api/modules/admin/plugins/updates.schema";
