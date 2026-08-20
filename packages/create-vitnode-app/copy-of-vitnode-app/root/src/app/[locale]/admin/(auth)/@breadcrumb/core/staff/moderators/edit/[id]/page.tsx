import React from "react";

import { BreadcrumbStaffEditAdmin } from "@vitnode/core/views/admin/layouts/breadcrumb/breadcrumb-staff-edit-admin";
import { BreadcrumbSkeleton } from "@vitnode/core/views/breadcrumb/breadcrumb-render";

export default function BreadcrumbSlot({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<BreadcrumbSkeleton crumbs={4} />}>
      <BreadcrumbStaffEditAdmin params={params} type="moderator" />
    </React.Suspense>
  );
}
