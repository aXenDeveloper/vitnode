import React from "react";

import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { AdminsStaffAdminView } from "@vitnode/core/views/admin/views/core/staff/admins/admins-staff-view";

export default function Page(
  props: React.ComponentProps<typeof AdminsStaffAdminView>,
) {
  return (
    <React.Suspense fallback={<DataTableSkeleton columns={3} />}>
      <AdminsStaffAdminView {...props} />
    </React.Suspense>
  );
}
