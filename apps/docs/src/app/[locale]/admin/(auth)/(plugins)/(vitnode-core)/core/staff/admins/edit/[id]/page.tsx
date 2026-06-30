import React from "react";

import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { Loader } from "@vitnode/core/components/ui/loader";
import { EditStaffPermissionsView } from "@vitnode/core/views/admin/views/core/staff/edit/edit-staff-permissions-view";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <I18nProvider namespaces="admin.staff">
      <div className="mx-auto max-w-4xl p-4">
        <React.Suspense fallback={<Loader />}>
          <EditStaffPermissionsView id={id} type="admin" />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
