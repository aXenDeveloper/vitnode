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
