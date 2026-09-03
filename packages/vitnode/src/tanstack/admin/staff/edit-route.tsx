import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";
import { createTranslator } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { StaffPluginGroup } from "@/views/admin/views/core/staff/staff-model";
import type {
  AdminStaffRole,
  AdminStaffRow,
} from "@/views/admin/views/core/staff/staff-query";

import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import {
  buildStaffPermissionGroups,
  chunkStaffLabelKeys,
  grantedStaffPermissionKeys,
  normalizeStaffEntryId,
  staffLabelKeys,
  staffLabelLookupFrom,
  staffListHref,
} from "@/views/admin/views/core/staff/staff-model";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions, MAX_NAMESPACES } from "../../i18n/query";
import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import { adminStaffCatalogQuery, adminStaffEntryQuery } from "./query";

export const ADMIN_STAFF_EDIT_NAMESPACES = [
  "admin.staff",
  "core.global",
] as const;

export const loadStaffPermissionLabels = async ({
  keys,
  locale,
  queryClient,
}: {
  keys: readonly string[];
  locale: string;
  queryClient: QueryClient;
}): Promise<Record<string, unknown>> => {
  const merged: Record<string, unknown> = {};

  for (const namespaces of chunkStaffLabelKeys(keys, MAX_NAMESPACES)) {
    const intl = await queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces }),
    );
    Object.assign(merged, intl.messages);
  }

  return merged;
};

/** The entry, reduced to what the screen actually renders about it. */
export interface AdminStaffEditSubject {
  protected: boolean;
  role: AdminStaffRole | null;
  self: boolean;
  user: AdminStaffRow["user"];
}

export interface AdminStaffEditRouteData {
  backHref: string;
  backLabel: string;
  grantedKeys: string[];
  id: string;
  plugins: StaffPluginGroup[];
  subject: AdminStaffEditSubject;
  title: string;
  type: PermissionStaffType;
  unrestricted: boolean;
}

export const loadAdminStaffEditRoute = async ({
  adminAccess,
  id: raw,
  locale,
  queryClient,
  type,
}: AdminScreenContext & {
  /** The `$id` segment, exactly as it was typed. Nothing has checked it yet. */
  id: string;
  type: PermissionStaffType;
}): Promise<AdminStaffEditRouteData> => {
  requireAdminPermission(adminAccess, adminStaffPermissions(type).edit);

  const id = normalizeStaffEntryId(raw);
  if (id === null) {
    // TanStack Router's own control-flow signal.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  const adminUserId = adminIdentityOf(adminAccess);

  const [intl, catalog, entry] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_STAFF_EDIT_NAMESPACES }),
    ),
    queryClient.ensureQueryData({
      ...adminStaffCatalogQuery({ adminUserId }),
      revalidateIfStale: true,
    }),
    queryClient.ensureQueryData({
      ...adminStaffEntryQuery({ adminUserId, id, type }),
      revalidateIfStale: true,
    }),
  ]);

  const labels = await loadStaffPermissionLabels({
    keys: staffLabelKeys({ catalog, type }),
    locale,
    queryClient,
  });

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { staff: { edit: { back: string; title: string } } };
    },
    namespace: "admin.staff.edit",
  });

  return {
    backHref: staffListHref(type),
    backLabel: t("back"),
    grantedKeys: [...grantedStaffPermissionKeys(entry.permissions)],
    id,
    plugins: buildStaffPermissionGroups({
      catalog,
      label: staffLabelLookupFrom(labels),
      type,
    }),
    subject: {
      protected: entry.protected,
      role: entry.role,
      self: entry.self,
      user: entry.user,
    },
    title: t("title"),
    type,
    unrestricted: entry.unrestricted,
  };
};
