"use client";

import { useQuery } from "@tanstack/react-query";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { normalizeAdminUserId } from "@/views/admin/views/core/users/detail/user-query";

import type { RouteBreadcrumbProps } from "../../breadcrumb/model";

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
 * ## Where the id comes from
 *
 * The shell hands every crumb the match that declared it, so the params arrive
 * as a prop - this route's own, not the deepest match's - and they are the
 * *parsed* value: a route's `params.parse` runs first, so what arrives here has
 * already been through `normalizeAdminUserId`. It is narrowed rather than
 * trusted all the same: a package cannot name a host's route types, so a
 * `params` reaching a crumb proves nothing about an `$id` being in scope.
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
  params,
}: Partial<Pick<RouteBreadcrumbProps, "params">> & {
  LinkComponent?: AuthLinkComponent;
}) => {
  const adminUserId = useAdminIdentity();
  const raw: unknown = params?.id;
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
