"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AdminFilesParams } from "@/views/admin/views/core/system/files/files-query";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { CONFIG_PLUGIN } from "@/config";
import { FilesTableContent } from "@/views/admin/views/core/system/files/files-table-content";

import type { AdminScreenContext } from "../screen";
import type { AdminTableNavigate } from "../table-search";
import type {
  AdminFilesRouteSearch,
  UncheckedAdminFilesSearch,
} from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { useAdminPermission } from "../permissions";
import { requireAdminPermission } from "../screen";
import { adminFilesQuery, useAdminFilesDeleteCallbacks } from "./query";
import { adminFilesSearchFrom, adminFilesSearchParams } from "./route-search";

/**
 * `/admin/core/system/files`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.system.files` is the heading, the columns, the metadata popover and
 * every word of both delete dialogs; `core.global` is the rest of the table -
 * the pager, the search placeholder, the confirm dialog's buttons and the error
 * toasts. The same set the Next.js page's
 * `<I18nProvider namespaces={["admin.system.files"]}>` provides.
 */
export const ADMIN_FILES_NAMESPACES = [
  "admin.system.files",
  "core.global",
] as const;

/** What {@link loadAdminFilesRoute} returns, and therefore what `head` receives. */
export interface AdminFilesRouteData {
  description: string;
  params: AdminFilesParams;
  title: string;
}

/** The core plugin, named once for the three tuples this screen reads. */
const FILES_MODULE = "files";

/**
 * The tuple `<AdminPermissionRequired module="files" permission="can_view">`
 * states in the Next.js page, and the one `listFilesAdminRoute` declares.
 */
const FILES_VIEW_PERMISSION = {
  module: FILES_MODULE,
  permission: "can_view",
} as const;

/**
 * Both reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked first, so an administrator who may not open the
 * screen never sends a request the API is going to refuse. A refusal from the
 * files API is left to propagate rather than caught: the Next.js page answers
 * one with `notFound()`, and the router's error path is the equivalent honest
 * answer. Rendering an empty table instead would be indistinguishable from an
 * installation with nothing uploaded.
 */
export const loadAdminFilesRoute = async ({
  adminAccess,
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: AdminFilesParams;
}): Promise<AdminFilesRouteData> => {
  requireAdminPermission(adminAccess, FILES_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_FILES_NAMESPACES }),
    ),
    queryClient.ensureQueryData(adminFilesQuery({ params })),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { system: { files: { desc: string; title: string } } };
    },
    namespace: "admin.system.files",
  });

  return { description: t("desc"), params, title: t("title") };
};

export interface AdminFilesRouteProps extends AdminFilesRouteData {
  navigate: AdminTableNavigate<AdminFilesRouteSearch>;
  search: UncheckedAdminFilesSearch;
}

/**
 * `/admin/core/system/files`, as everything below a route file's `component`.
 *
 * The two extra permissions are read here rather than in the table, from the
 * same admin session the `_admin` guard already resolved - so this is a context
 * read rather than two more requests, which is what the Next.js page spends on
 * `checkAdminPermissionApi`. They decide which controls render; the API
 * re-checks `files.can_download` and `files.can_delete` on the requests
 * themselves.
 */
export const AdminFilesRouteContent = ({
  description,
  navigate,
  params,
  search,
  title,
}: AdminFilesRouteProps) => {
  const { data } = useSuspenseQuery(adminFilesQuery({ params }));
  const { onDeleteFile, onDeleteFiles } = useAdminFilesDeleteCallbacks();
  const canDelete = useAdminPermission({
    module: FILES_MODULE,
    permission: "can_delete",
    plugin: CONFIG_PLUGIN.pluginId,
  });
  const canDownload = useAdminPermission({
    module: FILES_MODULE,
    permission: "can_download",
    plugin: CONFIG_PLUGIN.pluginId,
  });

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: adminFilesSearchFrom(nextSearch),
        });
      },
      searchParams: adminFilesSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_FILES_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title} />

        <DataTableNavigationProvider value={navigation}>
          <FilesTableContent
            canDelete={canDelete}
            canDownload={canDownload}
            data={data}
            onDeleteFile={onDeleteFile}
            onDeleteFiles={onDeleteFiles}
          />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
