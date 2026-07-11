import { BreadcrumbUserAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-user-admin";

export default async function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BreadcrumbUserAdmin id={id} />;
}
