import { BreadcrumbAdmin } from "@/views/admin/layouts/breadcrumb/breadcrumb-admin";

export default function BreadcrumbSlot() {
  return <BreadcrumbAdmin segments={["core", "system", "integrations"]} />;
}
