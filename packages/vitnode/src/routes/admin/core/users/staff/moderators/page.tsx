import React from "react";

import { DataTableSkeleton } from "@/components/table/data-table";
import { ModeratorsStaffAdminView } from "@/views/admin/views/core/staff/moderators/moderators-staff-view";

export default function Page(
  props: React.ComponentProps<typeof ModeratorsStaffAdminView>,
) {
  return (
    <React.Suspense fallback={<DataTableSkeleton columns={3} />}>
      <ModeratorsStaffAdminView {...props} />
    </React.Suspense>
  );
}
