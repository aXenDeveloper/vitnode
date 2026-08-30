import { createTranslator } from "use-intl";

import type { AdminFilesParams } from "@/views/admin/views/core/system/files/files-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";
import { adminFilesQuery } from "./query";

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
export const FILES_MODULE = "files";

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
    queryClient.ensureQueryData({
      ...adminFilesQuery({ params }),
      revalidateIfStale: true,
    }),
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
