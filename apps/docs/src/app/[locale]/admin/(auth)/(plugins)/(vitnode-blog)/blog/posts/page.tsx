import { blogPostContentType } from "@vitnode/blog/content/post";
import { contentAdminHref } from "@vitnode/core/content";
import { redirect } from "@vitnode/core/lib/navigation";

/**
 * The address articles used to live at.
 *
 * A redirect rather than a second list screen: the AdminCP linked here for
 * several releases, so the URL is in bookmarks and in muscle memory - but the
 * page behind it is now generated, and keeping a duplicate of it would mean two
 * tables to fix every time one of them was wrong.
 */
export default async function LegacyPostsPage() {
  await redirect(contentAdminHref(blogPostContentType.id));
}
