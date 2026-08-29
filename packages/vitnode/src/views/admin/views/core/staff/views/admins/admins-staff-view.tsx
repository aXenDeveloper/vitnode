import React from "react";

import { StaffListAdminView } from "../staff-list-view";

/** `/admin/core/staff/admins`, as one value handed to the shared screen. */
export const AdminsStaffAdminView = (
  props: Omit<React.ComponentProps<typeof StaffListAdminView>, "type">,
) => <StaffListAdminView {...props} type="admin" />;
