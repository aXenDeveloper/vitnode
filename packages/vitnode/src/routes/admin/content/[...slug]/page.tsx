import type { Metadata } from "next/dist/types";

import React from "react";

import {
  ContentAdminView,
  type ContentAdminViewProps,
  ContentAdminViewSkeleton,
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

export default function ContentAdminPage(props: ContentAdminViewProps) {
  return (
    <React.Suspense fallback={<ContentAdminViewSkeleton />}>
      <ContentAdminView {...props} />
    </React.Suspense>
  );
}
