"use client";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { useRouter } from "@/lib/navigation";
import { searchAdminUsersInBrowser } from "@/views/admin/views/core/users/list/users-query";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";

import { staffEditHref } from "../staff-model";
import { createStaffEntryAction } from "../staff-mutations.server";
import { CreateStaffFormContent } from "./create-staff-form-content";

/**
 * {@link CreateStaffFormContent}, wired to Next.js.
 *
 * Three bindings: the write is a Server Action, the navigation is `next-intl`'s
 * locale-aware router, and the two searches are direct browser reads shared with
 * the TanStack AdminCP. Where a created entry goes - `staffEditHref` - is the
 * package's decision in both, because it is VitNode's URL shape rather than this
 * application's.
 */
export const CreateStaffPermissionsForm = ({
  type,
}: {
  type: PermissionStaffType;
}) => {
  const { push } = useRouter();

  return (
    <CreateStaffFormContent
      onCreate={createStaffEntryAction}
      onCreated={id => {
        push(staffEditHref(type, id));
      }}
      searchRoles={searchAdminRolesInBrowser}
      searchUsers={searchAdminUsersInBrowser}
      type={type}
    />
  );
};
