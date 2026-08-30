import { createTranslator } from "use-intl";

import type { DebugLogsParams } from "@/views/admin/views/core/debug/debug-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { requireAdminPermission } from "../screen";
import { debugLogsQuery, debugQueueQuery } from "./query";

/**
 * `/admin/core/debug`, as everything a TanStack Start route needs and nothing a
 * route owns.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.debug` is the heading, the clear-cache dialog, the queue counters and
 * every column of the log; `admin.advanced.queue` is there for one component -
 * `QueueStatusBadge`, which the queue snapshot reuses from the queue list and
 * which reads `admin.advanced.queue.status.*`. `core.global` is the table
 * chrome. Exactly the set the Next.js page's
 * `<I18nProvider namespaces={["admin.debug", "admin.advanced.queue"]}>`
 * provides, which always adds `core.global` itself.
 */
export const ADMIN_DEBUG_NAMESPACES = [
  "admin.advanced.queue",
  "admin.debug",
  "core.global",
] as const;

/** What {@link loadAdminDebugRoute} returns, and therefore what `head` receives. */
export interface AdminDebugRouteData {
  description: string;
  logsTitle: string;
  params: DebugLogsParams;
  queueTitle: string;
  title: string;
}

/** The core plugin's `debug` module - both tuples on this screen use it. */
export const DEBUG_MODULE = "debug";

/**
 * The tuple both `<AdminPermissionRequired>` wrappers state in the Next.js page,
 * and the one `logsDebugAdminRoute` and `queueDebugAdminRoute` both declare.
 *
 * It gates the *screen*, not a section: in Next.js either wrapper answering "no"
 * calls `notFound()`, which replaces the whole page. Checking it once in the
 * loader is the same rule stated where it can be acted on before anything is
 * fetched.
 */
const DEBUG_VIEW_PERMISSION = {
  module: DEBUG_MODULE,
  permission: "can_view",
} as const;

/**
 * All three reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked first, so an administrator who may not open the
 * panel never sends either request.
 *
 * Both API refusals are left to propagate. An errored log rendered as an empty
 * table says "nothing has gone wrong", which on the one screen an operator opens
 * *because* something has gone wrong is the worst available answer.
 *
 * The two section headings are resolved here alongside the page title, so every
 * string on the screen comes from one translator call per navigation - which is
 * what `getTranslations` gives the Next.js page for free.
 */
export const loadAdminDebugRoute = async ({
  adminAccess,
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: DebugLogsParams;
}): Promise<AdminDebugRouteData> => {
  requireAdminPermission(adminAccess, DEBUG_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_DEBUG_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...debugQueueQuery(),
      revalidateIfStale: true,
    }),
    queryClient.ensureQueryData({
      ...debugLogsQuery({ params }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: {
        debug: {
          desc: string;
          logs: { title: string };
          queue: { title: string };
          title: string;
        };
      };
    },
    namespace: "admin.debug",
  });

  return {
    description: t("desc"),
    logsTitle: t("logs.title"),
    params,
    queueTitle: t("queue.title"),
    title: t("title"),
  };
};
