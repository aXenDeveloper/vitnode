"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { notFound, useParams } from "@tanstack/react-router";
import { createTranslator } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";
import type { AuthLinkComponent } from "@/views/auth/auth-link";
import type { SearchFeedLinkComponent } from "@/views/search/search-feed-content";

import { useAdminStaffPermissions } from "@/components/staff-permission/provider";
import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { UserDetailContent } from "@/views/admin/views/core/users/detail/user-detail-content";
import {
  canEditAdminUser,
  normalizeAdminUserId,
} from "@/views/admin/views/core/users/detail/user-query";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";
import { SearchFeedContent } from "@/views/search/search-feed-content";
import { searchFeedQueryOptions } from "@/views/search/search-feed-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { AdminBreadcrumb } from "../breadcrumb";
import { adminIdentityOf, useAdminIdentity } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminUserQuery, useAdminUserMutations } from "./query";

/**
 * `/admin/core/users/$id` - one user, as everything a TanStack Start route needs
 * and nothing a route owns.
 *
 * ## The dynamic segment, and what the route must do with it before this runs
 *
 * `$id` matches *any* segment. `normalizeAdminUserId` is what turns it into
 * either a decimal id or `null`, and a route calls it in `params.parse` so the
 * decision is made once, before the loader, the query key or the request exist.
 * The public URL is unchanged - `/admin/core/users/123` - and nothing here ever
 * sees `Number("abc")`.
 *
 * ## The permission model is the Next.js page's, unchanged
 *
 *     users.can_view        the page itself
 *     users.can_edit        the in-place editors and the roles dialog
 *     users.can_edit_admin  additionally, when the target is an administrator
 *
 * The last two are `canEditAdminUser`, which is the same predicate the Next.js
 * page builds from `getSessionAdminApi()`, and the same rule
 * `assertCanEditAdminTarget` enforces on every write.
 */

/**
 * What this screen renders strings from.
 *
 * `admin.user` is the page; `core.search` is the timeline tab and the feed
 * inside it; `core.global` is the dialogs, the forms and the error toasts. The
 * same set `<I18nProvider namespaces={["admin.user", "core.search"]}>` provides
 * in the Next.js page, which adds `core.global` itself.
 */
export const ADMIN_USER_NAMESPACES = [
  "admin.user",
  "core.global",
  "core.search",
] as const;

/** What {@link loadAdminUserRoute} returns, and therefore what `head` receives. */
export interface AdminUserRouteData {
  adminUserId: AdminIdentity;
  id: string;
  locale: string;
  title: string;
}

/**
 * Both reads this screen needs, before it renders.
 *
 * The user is fetched rather than prefetched because the `<title>` is built from
 * their name - the Next.js `generateMetadata` makes the same request for the
 * same reason, and both fall back to the bare heading when the read fails.
 *
 * A refusal propagates: `404` is a link to somebody who has been deleted and
 * `403` is an administrator who may no longer look, and both are the router's
 * error path rather than a page rendered around missing data.
 */
export const loadAdminUserRoute = async ({
  adminAccess,
  id: raw,
  locale,
  queryClient,
}: AdminScreenContext & {
  /** The `$id` segment, exactly as it was typed. Nothing has checked it yet. */
  id: string;
}): Promise<AdminUserRouteData> => {
  requireAdminPermission(adminAccess, ADMIN_USER_PERMISSIONS.view);

  /**
   * The one place `$id` becomes an id.
   *
   * Here rather than in the route's `params.parse`, and that is deliberate:
   * `parse` runs inside `matchRoutes`, which `isTanStackOwnedPath` calls to
   * decide whether *this* application serves a path at all - so a `parse` that
   * threw would take down the link component for every href it was asked about.
   *
   * `notFound()` rather than a `400`: `/admin/core/users/abc` is a URL that
   * names no user, which is what a not-found screen is for, and it is the same
   * answer the API gives (`show.route.ts` refuses a non-integer id with a
   * `404`). Nothing below this line has ever seen `Number("abc")`.
   */
  const id = normalizeAdminUserId(raw);
  if (id === null) {
    // TanStack Router's own control-flow signal.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  const adminUserId = adminIdentityOf(adminAccess);

  const [intl, user] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_USER_NAMESPACES }),
    ),
    queryClient.ensureQueryData(adminUserQuery({ adminUserId, id })),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { user: { show: { title: string } } };
    },
    namespace: "admin.user.show",
  });

  return {
    adminUserId,
    id,
    locale,
    title: `${user.name} - ${t("title")}`,
  };
};

export interface AdminUserRouteProps extends AdminUserRouteData {
  LinkComponent: AuthLinkComponent;
}

/**
 * The activity feed on the timeline tab.
 *
 * The same `SearchFeed` the Next.js page renders, minus the Next.js binding: the
 * shared content component takes the query options and a link, and the locale
 * comes from the loader rather than from `next-intl`'s request scope.
 *
 * `authorId` is the *listed* user, which is what makes this a profile timeline
 * rather than the site feed. It is a filter on a public search index, so nothing
 * here is a permission decision.
 */
const UserTimeline = ({
  LinkComponent,
  locale,
  userId,
}: {
  LinkComponent: SearchFeedLinkComponent;
  locale: string;
  userId: number;
}) => (
  <SearchFeedContent
    LinkComponent={LinkComponent}
    queryOptions={searchFeedQueryOptions({
      locale,
      params: { authorId: String(userId), sort: "newest" },
    })}
    variant="timeline"
  />
);

export const AdminUserRouteContent = ({
  adminUserId,
  id,
  LinkComponent,
  locale,
}: AdminUserRouteProps) => {
  const { data: user } = useSuspenseQuery(adminUserQuery({ adminUserId, id }));
  const { onUpdate, onUpdateRoles } = useAdminUserMutations();
  const permissions = useAdminStaffPermissions();

  return (
    <RouteMessages namespaces={ADMIN_USER_NAMESPACES}>
      <div className="p-4">
        <UserDetailContent
          canEdit={canEditAdminUser(permissions, { isAdmin: user.isAdmin })}
          LinkComponent={LinkComponent}
          onUpdate={onUpdate}
          onUpdateRoles={onUpdateRoles}
          searchRoles={searchAdminRolesInBrowser}
          timeline={
            <UserTimeline
              LinkComponent={LinkComponent}
              locale={locale}
              userId={user.id}
            />
          }
          user={user}
        />
      </div>
    </RouteMessages>
  );
};

/**
 * The breadcrumb this screen contributes.
 *
 * The trail is `Core / Users / <the user's name>`, and the last crumb is data:
 * the navigation has no entry for `/admin/core/users/123`, so `resolveBreadcrumb`
 * would humanise the id into "123". The Next.js `@breadcrumb` slot solves that by
 * fetching the user a second time; this reads the entry the loader already
 * filled, so there is no second request and no second answer.
 *
 * ## Why it reads the id off the router rather than taking it as a prop
 *
 * `staticData.breadcrumb` is a fixed `ReactNode`, declared next to the route
 * options and evaluated before any of this route's params exist - so a crumb
 * that needs one has to ask. `useParams({ strict: false })` is the router's own
 * answer to that, and it is the *parsed* value: a route's `params.parse` runs
 * first, so what arrives here has already been through `normalizeAdminUserId`.
 *
 * ## Why it mounts `RouteMessages` of its own
 *
 * The shell renders the breadcrumb *above* the route's component, so it is
 * outside the provider that component mounts. Without this it would translate
 * against the root's `core.global` alone.
 *
 * `useQuery` rather than `useSuspenseQuery`: a crumb must never suspend the
 * header the whole panel is framed by. Before the name arrives the trail simply
 * ends in the id, which is what the URL says anyway.
 */
export const AdminUserBreadcrumbContent = ({
  LinkComponent,
}: {
  LinkComponent?: AuthLinkComponent;
}) => {
  const adminUserId = useAdminIdentity();
  /**
   * `strict: false` because a package cannot name a host's route id, so the
   * params come back untyped - which is honest: the shell renders this component
   * from `staticData`, and nothing there proves a `$id` is in scope. Narrowed
   * rather than asserted, and normalised rather than trusted: the crumb reads
   * the cache entry the loader filled, and only one spelling of an id names it.
   */
  const params: unknown = useParams({ strict: false });
  const raw = (params as { id?: unknown }).id;
  const id = normalizeAdminUserId(typeof raw === "string" ? raw : undefined);
  const { data } = useQuery({
    ...adminUserQuery({ adminUserId, id: id ?? "" }),
    enabled: id !== null,
  });

  return (
    <RouteMessages namespaces={ADMIN_USER_NAMESPACES}>
      <AdminBreadcrumb
        LinkComponent={LinkComponent}
        overrideLastLabel={data?.name}
        segments={["core", "users", id ?? (typeof raw === "string" ? raw : "")]}
      />
    </RouteMessages>
  );
};
