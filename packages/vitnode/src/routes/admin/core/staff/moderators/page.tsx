import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { ModeratorsStaffAdminView } from "@/views/admin/views/core/staff/views/moderators/moderators-staff-view";

export default function Page(
  props: React.ComponentProps<typeof ModeratorsStaffAdminView>,
) {
  return (
    <I18nProvider namespaces="admin.staff">
      <ModeratorsStaffAdminView {...props} />
    </I18nProvider>
  );
}
