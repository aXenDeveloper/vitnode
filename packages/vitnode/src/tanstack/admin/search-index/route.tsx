import { createTranslator } from "use-intl";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";
import { searchIndexQuery } from "./query";

/**
 * `/admin/core/advanced/search`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

export const ADMIN_SEARCH_INDEX_NAMESPACES = [
  "core.global",
  "core.search",
] as const;

/** What {@link loadAdminSearchIndexRoute} returns - and what `head` receives. */
export interface AdminSearchIndexRouteData {
  description: string;
  title: string;
}

const SEARCH_INDEX_PERMISSION = {
  module: "system",
  permission: "can_view",
} as const;

export const loadAdminSearchIndexRoute = async ({
  adminAccess,
  locale,
  queryClient,
}: AdminScreenContext): Promise<AdminSearchIndexRouteData> => {
  requireAdminPermission(adminAccess, SEARCH_INDEX_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_SEARCH_INDEX_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...searchIndexQuery(),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      core: { search: { admin: { desc: string; title: string } } };
    },
    namespace: "core.search.admin",
  });

  return { description: t("desc"), title: t("title") };
};
