import { contentAdminHref } from "@vitnode/core/content";
import { redirect } from "@vitnode/core/lib/navigation";

import { blogCategoryContentType } from "@vitnode/blog/content/category";

/** The address categories used to live at. See the posts page next door. */
export default async function LegacyCategoriesPage() {
  await redirect(contentAdminHref(blogCategoryContentType.id));
}
