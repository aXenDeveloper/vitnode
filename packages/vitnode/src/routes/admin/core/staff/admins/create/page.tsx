import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { Loader } from "@/components/ui/loader";
import { CreateStaffPermissionsView } from "@/views/admin/views/core/staff/create/create-staff-permissions-view";

export default function Page() {
  return (
    <I18nProvider namespaces="admin.staff">
      <div className="mx-auto max-w-4xl p-4">
        <React.Suspense fallback={<Loader />}>
          <CreateStaffPermissionsView type="admin" />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
