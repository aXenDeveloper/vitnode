import { notFound } from "@tanstack/react-router";
import { createTranslator } from "use-intl";

import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { ADMIN_USER_PERMISSIONS } from "@/views/admin/views/core/shared/admin-permissions";
import { normalizeAdminUserId } from "@/views/admin/views/core/users/detail/user-query";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions } from "../../i18n/query";
import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminUserQuery } from "./query";

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
    queryClient.ensureQueryData({
      ...adminUserQuery({ adminUserId, id }),
      revalidateIfStale: true,
    }),
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
