import { BreadcrumbAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-admin";

// Generic catch-all breadcrumb for every authenticated admin route (core +
// plugins). More specific slot folders (e.g. core/users/[nameCode]) override it.
//
// NOTE: must live at the `@breadcrumb` slot ROOT (not under a `(plugins)` route
// group) — a parallel-route slot only matches `children` sharing its route-group
// structure, so a nested catch-all would miss pages from other plugin groups.
export default async function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ all?: string[] }>;
}) {
  const { all } = await params;

  return <BreadcrumbAdmin segments={all ?? []} />;
}
