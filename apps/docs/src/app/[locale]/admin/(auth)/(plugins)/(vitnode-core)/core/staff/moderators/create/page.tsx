import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { Loader } from "@vitnode/core/components/ui/loader";
import { CreateStaffPermissionsView } from "@vitnode/core/views/admin/views/core/staff/create/create-staff-permissions-view";

export default function Page() {
  return (
    <I18nProvider namespaces="admin.staff">
      <div className="mx-auto max-w-4xl p-4">
        <React.Suspense fallback={<Loader />}>
          <CreateStaffPermissionsView type="moderator" />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
