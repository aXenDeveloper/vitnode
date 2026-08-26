import React from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { Loader } from "@/components/ui/loader";
import { EditStaffPermissionsView } from "@/views/admin/views/core/staff/edit/edit-staff-permissions-view";

const EditStaffPermissions = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  return <EditStaffPermissionsView id={id} type="admin" />;
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <I18nProvider namespaces="admin.staff">
      <div className="mx-auto max-w-4xl p-4">
        <React.Suspense fallback={<Loader />}>
          <EditStaffPermissions params={params} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
