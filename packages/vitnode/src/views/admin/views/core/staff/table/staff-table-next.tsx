"use client";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { NextDataTableNavigation } from "@/components/table/navigation-next";
import { Link, useRouter } from "@/lib/navigation";

import type { AdminStaffPage } from "../staff-query";

import { deleteStaffEntryAction } from "../staff-mutations.server";
import { StaffTableContent } from "./staff-table-content";

/**
 * {@link StaffTableContent}, wired to Next.js.
 *
 * One binding: the delete is a Server Action, because it ends in
 * `revalidatePath`. `router.refresh()` on top of it, so the row disappears from
 * the render that is on screen rather than only from the next one.
 */
export const StaffTableNext = ({
  data,
  type,
}: {
  data: AdminStaffPage;
  type: PermissionStaffType;
}) => {
  const { refresh } = useRouter();

  return (
    <NextDataTableNavigation>
      <StaffTableContent
        data={data}
        LinkComponent={Link}
        onDelete={deleteStaffEntryAction}
        onDeleted={refresh}
        type={type}
      />
    </NextDataTableNavigation>
  );
};
