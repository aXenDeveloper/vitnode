"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { createTranslator } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { CronParams } from "@/views/admin/views/core/advanced/cron/cron-query";

import { DataTableNavigationProvider } from "@/components/table/navigation";
import { HeaderContent } from "@/components/ui/header-content";
import { CronTableContent } from "@/views/admin/views/core/advanced/cron/cron-table-content";

import type { AdminScreenContext } from "../screen";
import type { AdminTableNavigate } from "../table-search";
import type { CronRouteSearch, UncheckedCronSearch } from "./route-search";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { requireAdminPermission } from "../screen";
import { cronQuery, useCronRunCallback } from "./query";
import { cronSearchFrom, cronSearchParams } from "./route-search";

/**
 * `/admin/core/advanced/cron`, as everything a TanStack Start route needs and
 * nothing a route owns.
 *
 * The topology - the file's path, its search contract and its `navigate` - stays
 * in the host, because TanStack infers all three from `createFileRoute`.
 * Everything else is here: the namespaces, the permission, the query, the title
 * and the table.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.advanced.cron` is the heading, the columns and the run button;
 * `core.global` is the rest of the table - the pager's labels, the confirm
 * dialog's buttons and the error toasts - and it is listed even though the root
 * provides it, because `RouteMessages` mounts its own provider *over* the root's
 * rather than adding to it.
 *
 * The same set `<I18nProvider namespaces={["admin.advanced.cron"]}>` provides in
 * the Next.js page, which always adds `core.global` itself.
 *
 * One list, read by both the loader that fetches it and the provider that mounts
 * it, because they have to be the same set or the provider suspends on a key
 * nobody warmed.
 */
export const ADMIN_CRON_NAMESPACES = [
  "admin.advanced.cron",
  "core.global",
] as const;

/** What {@link loadAdminCronRoute} returns, and therefore what `head` receives. */
export interface AdminCronRouteData {
  description: string;
  params: CronParams;
  title: string;
}

/**
 * The permission this screen needs, on top of an admin session.
 *
 * `cron.can_view`, which is the tuple `<AdminPermissionRequired module="cron"
 * permission="can_view">` states in the Next.js page and the tuple
 * `getCronsRoute` declares as its `adminStaffPermission`. All three have to be
 * the same, and this is the frontend's copy of it.
 */
const CRON_VIEW_PERMISSION = {
  module: "cron",
  permission: "can_view",
} as const;

/**
 * Both reads this screen needs, in parallel, before it renders.
 *
 * The permission is checked *first*, before either read is started: an
 * administrator who may not open this screen never sends a request the API is
 * going to refuse, and no admin markup is streamed for a page that is about to
 * be replaced by the AdminCP's 404.
 *
 * Neither call is repeated by the component: the messages are read back by
 * `RouteMessages` through the identical `intlQueryOptions`, and the page by
 * `useSuspenseQuery` through the identical `cronQuery`.
 *
 * A refusal from the cron API is deliberately left to propagate. `403` and `429`
 * reject as `AdminRequestError`, which fails this loader and shows the router's
 * error path - the honest answer. Catching it and rendering an empty table is
 * indistinguishable from an installation with no cron jobs, which is the one
 * thing this must never look like.
 *
 * The cast on `messages` is what makes `createTranslator` usable: its key type is
 * derived from the *inferred* type of `messages`, and a bare index signature
 * collapses `MessageKeys` to `never`. Naming the two keys read here is both the
 * smallest fix and a true statement - rename either in `locales/en.json` and
 * this stops compiling rather than rendering a raw key into a `<title>`.
 */
export const loadAdminCronRoute = async ({
  adminAccess,
  locale,
  params,
  queryClient,
}: AdminScreenContext & {
  params: CronParams;
}): Promise<AdminCronRouteData> => {
  requireAdminPermission(adminAccess, CRON_VIEW_PERMISSION);

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_CRON_NAMESPACES }),
    ),
    queryClient.ensureQueryData(cronQuery({ params })),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { advanced: { cron: { desc: string; title: string } } };
    },
    namespace: "admin.advanced.cron",
  });

  return { description: t("desc"), params, title: t("title") };
};

export interface AdminCronRouteProps extends AdminCronRouteData {
  navigate: AdminTableNavigate<CronRouteSearch>;
  search: UncheckedCronSearch;
}

/**
 * `/admin/core/advanced/cron`, as everything below a route file's `component`.
 *
 * `navigate` and `search` come from the host because they are route-typed:
 * TanStack infers both from the `createFileRoute` path, which is an application
 * concern and stays in the application.
 *
 * The heading is outside the table on purpose, exactly as in the Next.js page:
 * it is rendered from the loader's own strings, so the `<h1>` and the `<title>`
 * are the same string by construction.
 */
export const AdminCronRouteContent = ({
  description,
  navigate,
  params,
  search,
  title,
}: AdminCronRouteProps) => {
  const { data } = useSuspenseQuery(cronQuery({ params }));
  const onRun = useCronRunCallback();

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: cronSearchFrom(nextSearch),
        });
      },
      searchParams: cronSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <RouteMessages namespaces={ADMIN_CRON_NAMESPACES}>
      <div className="p-4">
        <HeaderContent desc={description} h1={title} />

        <DataTableNavigationProvider value={navigation}>
          <CronTableContent data={data} onRun={onRun} />
        </DataTableNavigationProvider>
      </div>
    </RouteMessages>
  );
};
