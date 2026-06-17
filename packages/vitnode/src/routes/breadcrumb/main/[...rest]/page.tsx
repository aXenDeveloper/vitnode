import { BreadcrumbMain } from "@/views/breadcrumb/breadcrumb-main";

// Generic catch-all breadcrumb for public pages: humanizes URL segments.
// Specific slot folders (login, register, …) override it with translated labels.
//
// NOTE: must live at the `@breadcrumb` slot ROOT (not under a `(plugins)` route
// group) — a parallel-route slot only matches `children` sharing its route-group
// structure, so a nested catch-all would miss pages outside that group.
export default async function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest } = await params;

  return <BreadcrumbMain segments={rest ?? []} />;
}
