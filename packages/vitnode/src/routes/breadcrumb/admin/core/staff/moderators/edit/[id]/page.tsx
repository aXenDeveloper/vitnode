import { BreadcrumbStaffEditAdmin } from "@/views/admin/layouts/breadcrumb/breadcrumb-staff-edit-admin";

export default async function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BreadcrumbStaffEditAdmin id={id} type="moderator" />;
}
