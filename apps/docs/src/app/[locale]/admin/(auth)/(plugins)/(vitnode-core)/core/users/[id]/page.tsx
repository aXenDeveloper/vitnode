import type { Metadata } from "next/dist/types";

import { getTranslations } from "next-intl/server";
import dynamic from "next/dynamic";
import React from "react";

import { adminModule } from "@vitnode/core/api/modules/admin/admin.module";
import { I18nProvider } from "@vitnode/core/components/i18n-provider";
import { Loader } from "@vitnode/core/components/ui/loader";
import { awaitRequest } from "@vitnode/core/framework/request";
import { fetcher } from "@vitnode/core/lib/fetcher";

const ShowUserAdminView = dynamic(async () =>
  import("@vitnode/core/views/admin/views/core/users/show/show-user-admin-view").then(
    module => ({
      default: module.ShowUserAdminView,
    }),
  ),
);

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const t = await getTranslations("admin.user.show");
  const res = await fetcher(adminModule, {
    path: "/{id}",
    method: "get",
    module: "admin/users",
    args: {
      params: { id },
    },
  });

  if (!res.ok) {
    return {
      title: t("title"),
    };
  }

  const data = await res.json();

  return {
    title: `${data.name} - ${t("title")}`,
  };
};

/**
 * `generateMetadata` puts the user's name in the title, which needs a fetch that
 * cannot be cached - `fetcher` forwards the request's cookies and `use cache`
 * cannot enclose a runtime read. This marks the route as intentionally partly
 * dynamic so the metadata is allowed to be, while the body still prerenders.
 */
const DynamicMarker = async () => {
  await awaitRequest();

  return null;
};

const ShowUserAdmin = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  return <ShowUserAdminView id={id} />;
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <I18nProvider namespaces={["admin.user", "core.search"]}>
      <div className="p-4">
        <React.Suspense fallback={null}>
          <DynamicMarker />
        </React.Suspense>

        <React.Suspense fallback={<Loader />}>
          <ShowUserAdmin params={params} />
        </React.Suspense>
      </div>
    </I18nProvider>
  );
}
