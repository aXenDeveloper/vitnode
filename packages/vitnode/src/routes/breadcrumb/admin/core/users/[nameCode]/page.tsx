import { BreadcrumbUserAdmin } from "@/views/admin/layouts/breadcrumb/breadcrumb-user-admin";

// Resolves the real user name server-side for the user detail breadcrumb.
export default async function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ nameCode: string }>;
}) {
  const { nameCode } = await params;

  return <BreadcrumbUserAdmin nameCode={nameCode} />;
}
