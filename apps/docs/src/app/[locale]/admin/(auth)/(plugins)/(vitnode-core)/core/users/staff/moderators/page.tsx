import React from "react";

import { DataTableSkeleton } from "@vitnode/core/components/table/data-table";
import { ModeratorsStaffAdminView } from "@vitnode/core/views/admin/views/core/staff/moderators/moderators-staff-view";

export default function Page(
  props: React.ComponentProps<typeof ModeratorsStaffAdminView>,
) {
  return (
    <React.Suspense fallback={<DataTableSkeleton columns={3} />}>
      <ModeratorsStaffAdminView {...props} />
    </React.Suspense>
  );
}
