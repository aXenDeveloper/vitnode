"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { normalizeAdminUserId } from "@/views/admin/views/core/users/detail/user-query";

import { RouteMessages } from "../../i18n/route-messages";
import { AdminBreadcrumb } from "../breadcrumb";
import { useAdminIdentity } from "../identity";
import { ADMIN_USER_NAMESPACES } from "./detail-route";
import { adminUserQuery } from "./query";
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
