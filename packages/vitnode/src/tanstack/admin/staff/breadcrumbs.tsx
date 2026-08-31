"use client";

import { useTranslations } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import {
  STAFF_TYPE_SEGMENT,
  staffBreadcrumbLabels,
} from "@/views/admin/views/core/staff/staff-model";

import { RouteMessages } from "../../i18n/route-messages";
import { AdminBreadcrumb } from "../breadcrumb";

/**
 * The trail above the three staff screens.
 *
 * Two of its crumbs cannot be resolved from the navigation, which is what
 * `resolveBreadcrumb` normally does: `/admin/core/staff` is a nav *group* with no
 * page of its own, and the list beneath it appears in the sidebar under a
 * shorter name than the page's own heading. So both are named explicitly, from
 * `staffBreadcrumbLabels` - the same helper the Next.js `@breadcrumb` slots use,
 * so the two applications produce the same trail.
 *
 * ## Each one mounts `RouteMessages` of its own
 *
 * The shell renders the breadcrumb *above* the route's component, so it is
 * outside the provider that component mounts. Without this they would translate
 * against the root's `core.global` alone and render raw keys.
 */

const STAFF_BREADCRUMB_NAMESPACES = ["admin.staff", "core.global"] as const;

interface StaffBreadcrumbProps {
  LinkComponent?: AuthLinkComponent;
  type: PermissionStaffType;
}

/** The labels every staff crumb overrides, in the reader's language. */
const useStaffLabels = (type: PermissionStaffType) => {
  const t = useTranslations("admin.staff");

  return staffBreadcrumbLabels({
    listLabel: t(`tabs.${STAFF_TYPE_SEGMENT[type]}`),
    staffLabel: t("title"),
    type,
  });
};

const StaffListCrumb = ({ LinkComponent, type }: StaffBreadcrumbProps) => {
  const labels = useStaffLabels(type);

  return (
    <AdminBreadcrumb
      labels={labels}
      LinkComponent={LinkComponent}
      segments={["core", "staff", STAFF_TYPE_SEGMENT[type]]}
    />
  );
};

const StaffCreateCrumb = ({ LinkComponent, type }: StaffBreadcrumbProps) => {
  const labels = useStaffLabels(type);
  const t = useTranslations("admin.staff.create");

  return (
    <AdminBreadcrumb
      labels={labels}
      LinkComponent={LinkComponent}
      overrideLastLabel={t("button")}
      segments={["core", "staff", STAFF_TYPE_SEGMENT[type], "create"]}
    />
  );
};

const StaffEditCrumb = ({ LinkComponent, type }: StaffBreadcrumbProps) => {
  const labels = useStaffLabels(type);
  const t = useTranslations("admin.staff.edit");

  return (
    <AdminBreadcrumb
      labels={labels}
      LinkComponent={LinkComponent}
      overrideLastLabel={t("title")}
      segments={["core", "staff", STAFF_TYPE_SEGMENT[type], "edit"]}
    />
  );
};

export const AdminStaffBreadcrumbContent = (props: StaffBreadcrumbProps) => (
  <RouteMessages namespaces={STAFF_BREADCRUMB_NAMESPACES}>
    <StaffListCrumb {...props} />
  </RouteMessages>
);

export const AdminStaffCreateBreadcrumbContent = (
  props: StaffBreadcrumbProps,
) => (
  <RouteMessages namespaces={STAFF_BREADCRUMB_NAMESPACES}>
    <StaffCreateCrumb {...props} />
  </RouteMessages>
);

export const AdminStaffEditBreadcrumbContent = (
  props: StaffBreadcrumbProps,
) => (
  <RouteMessages namespaces={STAFF_BREADCRUMB_NAMESPACES}>
    <StaffEditCrumb {...props} />
  </RouteMessages>
);
