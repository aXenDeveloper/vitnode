import React from "react";

import { BreadcrumbUserAdmin } from "@/views/admin/layouts/breadcrumb/breadcrumb-user-admin";
import { BreadcrumbSkeleton } from "@/views/breadcrumb/breadcrumb-render";

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
