import { notFound } from "next/navigation";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

import { adminStaffRequest, normalizeAdminStaffParams } from "../staff-query";
import { StaffTableNext } from "./staff-table-next";

/**
 * One staff list, as this application's Server Component.
 *
 * Reads the page with the request's own cookies and hands it to the shared
 * table - the columns, the padlock on a protected or self entry, and the two
 * permission-gated buttons are `StaffTableContent`, which the TanStack AdminCP
 * renders too.
 *
 * `type` is the API's vocabulary (`admin`/`moderator`) rather than the URL's
 * (`admins`/`moderators`); `STAFF_TYPE_SEGMENT` maps between them, and this
 * takes the former because everything below it does.
 */
export const StaffTableAdmin = async ({
  searchParams,
  type,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  type: PermissionStaffType;
}) => {
  const params = normalizeAdminStaffParams(await searchParams);
  const res = await fetcher(adminModule, adminStaffRequest(type, params));

  if (res.status !== 200) {
    return notFound();
  }

  return <StaffTableNext data={await res.json()} type={type} />;
};
