import React from "react";

import { BreadcrumbUserAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-user-admin";
import { BreadcrumbSkeleton } from "@vitnode/core/views/breadcrumb/breadcrumb-render";

export default function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<BreadcrumbSkeleton crumbs={3} />}>
      <BreadcrumbUserAdmin params={params} />
    </React.Suspense>
  );
}
