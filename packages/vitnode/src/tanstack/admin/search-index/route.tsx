import { createTranslator } from "use-intl";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";
import { searchIndexQuery } from "./query";

/**
 * `/admin/core/advanced/search`, as everything a TanStack Start route needs and
 * nothing a route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `core.search` and not an `admin.*` namespace, which looks wrong and is not:
 * the search index's AdminCP copy lives under `core.search.admin.*`, beside the
 * public feed's, because the collection labels and the result-type names are the
 * same strings on both surfaces. The Next.js page declares the identical
 * `<I18nProvider namespaces="core.search">`.
 *
 * `core.global` is the table chrome - the search placeholder, the confirm
 * dialog's buttons and the error toasts.
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

/**
 * The tuple `<AdminPermissionRequired module="system" permission="can_view">`
 * states in the Next.js page, and the one every `/admin/debug/search/*` route
 * declares - the status read and both mutations.
 */
const SEARCH_INDEX_PERMISSION = {
  module: "system",
  permission: "can_view",
} as const;

/**
 * Both reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked first, so an administrator who may not open the
 * screen never sends a request the API is going to refuse.
 *
 * A refusal is left to propagate rather than caught. This screen's whole job is
 * to say whether search is healthy; a failed read rendered as "unhealthy, zero
 * documents" would be a false alarm, and rendered as "healthy" would be a lie.
 */
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
