import type { Metadata } from "next/dist/types";

import {
  ContentAdminView,
  type ContentAdminViewProps,
  getContentLabels,
  resolveContentType,
} from "@/views/admin/views/content/content-admin-view";

export const generateMetadata = async ({
  params,
}: ContentAdminViewProps): Promise<Metadata> => {
  const entry = await resolveContentType(params);
  if (!entry) return {};

  const labels = await getContentLabels(entry);

  return { description: labels.desc, title: labels.title };
};

/**
 * One route serves every registered content type - the slug maps onto a content
 * type id (`/admin/content/example/article` -> `example.article`), so a plugin
 * adds a content type without adding a single Next.js file.
 */
export default function ContentAdminPage(props: ContentAdminViewProps) {
  return <ContentAdminView {...props} />;
}
