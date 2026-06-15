import { BreadcrumbAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-admin";

// Generic catch-all breadcrumb for every authenticated admin route (core +
// plugins). More specific slot folders (e.g. core/users/[nameCode]) override it.
//
// NOTE: keep this a required catch-all `[...all]`, not an optional `[[...all]]` —
// an optional catch-all as a parallel-route slot crashes the Next dev server.
export default async function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ all?: string[] }>;
}) {
  const { all } = await params;

  return <BreadcrumbAdmin segments={all ?? []} />;
}
