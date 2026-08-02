import { BreadcrumbAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-admin";
import {
  getContentLabels,
  resolveContentType,
} from "@vitnode/core/views/admin/views/content/content-admin-view";

export default async function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const entry = await resolveContentType(params);
  const labels = entry ? await getContentLabels(entry) : undefined;

  return (
    <BreadcrumbAdmin
      overrideLastLabel={labels?.title}
      segments={["content", ...slug]}
    />
  );
}
