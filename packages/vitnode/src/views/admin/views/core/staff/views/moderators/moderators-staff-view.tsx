import React from "react";

import { StaffListAdminView } from "../staff-list-view";

/** `/admin/core/staff/moderators`, as one value handed to the shared screen. */
export const ModeratorsStaffAdminView = (
  props: Omit<React.ComponentProps<typeof StaffListAdminView>, "type">,
) => <StaffListAdminView {...props} type="moderator" />;
