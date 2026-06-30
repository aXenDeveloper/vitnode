import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { AdminsStaffAdminView } from "@vitnode/core/views/admin/views/core/staff/views/admins/admins-staff-view";

export default function Page(
  props: React.ComponentProps<typeof AdminsStaffAdminView>,
) {
  return (
    <I18nProvider namespaces="admin.staff">
      <AdminsStaffAdminView {...props} />
    </I18nProvider>
  );
}
