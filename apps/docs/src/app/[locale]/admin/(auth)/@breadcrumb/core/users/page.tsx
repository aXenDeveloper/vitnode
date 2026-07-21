import { BreadcrumbAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-admin";

export default function BreadcrumbSlot() {
  return <BreadcrumbAdmin segments={["core", "users"]} />;
}
