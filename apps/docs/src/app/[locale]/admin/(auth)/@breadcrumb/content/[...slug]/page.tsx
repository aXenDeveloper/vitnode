import { getTranslations } from "next-intl/server";

import { contentTypeName } from "@vitnode/core/content/admin/labels";
import {
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
} from "@vitnode/core/content/const";
import { contentAdminHref } from "@vitnode/core/content/registry";
import { BreadcrumbAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-admin";
import {
  getContentLabels,
  resolveContentRoute,
} from "@vitnode/core/views/admin/views/content/content-admin-view";

export default async function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const route = await resolveContentRoute(params);
  const labels = route ? await getContentLabels(route.entry) : undefined;

  if (!route || route.action === "list") {
    return (
      <BreadcrumbAdmin
        overrideLastLabel={labels?.title}
        segments={["content", ...slug]}
      />
    );
  }

  const t = await getTranslations("core.content");
  const { definition } = route.entry;

  return (
    <BreadcrumbAdmin
      labels={
        labels?.title ? { [contentAdminHref(definition)]: labels.title } : {}
      }
      overrideLastLabel={t(
        route.action === "create" ? "create.title" : "edit.title",
        { name: labels?.singular ?? contentTypeName(definition.id) },
      )}
      segments={[
        "content",
        ...definition.admin.path.split("/"),
        route.action === "create"
          ? CONTENT_ADMIN_CREATE_SEGMENT
          : CONTENT_ADMIN_EDIT_SEGMENT,
      ]}
    />
  );
}
