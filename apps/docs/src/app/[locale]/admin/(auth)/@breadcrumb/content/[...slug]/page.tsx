import React from "react";

import { BreadcrumbContentAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-content-admin";
import { BreadcrumbSkeleton } from "@vitnode/core/views/breadcrumb/breadcrumb-render";

export default function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  return (
    <React.Suspense fallback={<BreadcrumbSkeleton />}>
      <BreadcrumbContentAdmin params={params} />
    </React.Suspense>
  );
}
