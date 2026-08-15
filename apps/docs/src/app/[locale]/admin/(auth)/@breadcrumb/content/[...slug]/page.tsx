import { getTranslations } from "next-intl/server";

import { contentTypeName } from "@vitnode/core/content/admin/labels";
import {
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
} from "@vitnode/core/content/const";
import { contentAdminHref, contentTypeToPath } from "@vitnode/core/content/registry";
import { BreadcrumbAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-admin";
import {
  getContentLabels,
  resolveContentRoute,
} from "@vitnode/core/views/admin/views/content/content-admin-view";

/**
 * The breadcrumb of every generated Content Engine screen.
 *
 * The list keeps the trail it always had. A create or an edit **page** appends
 * one more crumb, labelled from `core.content` with the content type's own
 * singular - so it reads "Blog / Articles / Create article" in whatever language
 * the AdminCP is in, and "Articles" becomes a link back to the list.
 *
 * The record id is deliberately **not** a crumb of its own: `/42/` would render
 * as a dead "42" between two words, and the page it would point at is the one
 * being read.
 */
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
      // The list crumb sits mid-trail now, so it is labelled by href rather than
      // by `overrideLastLabel` - which is also what turns it into a link back to
      // where the person came from.
      labels={
        labels?.title ? { [contentAdminHref(definition.id)]: labels.title } : {}
      }
      overrideLastLabel={t(
        route.action === "create" ? "create.title" : "edit.title",
        // The translated noun, like every other "Create {name}" in the AdminCP -
        // the definition's English is only its fallback.
        { name: labels?.singular ?? contentTypeName(definition.id) },
      )}
      segments={[
        "content",
        ...contentTypeToPath(definition.id).split("/"),
        route.action === "create"
          ? CONTENT_ADMIN_CREATE_SEGMENT
          : CONTENT_ADMIN_EDIT_SEGMENT,
      ]}
    />
  );
}
