import { notFound } from "next/navigation";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

import { adminRolesRequest, normalizeAdminRolesParams } from "./roles-query";
import { RolesAdminTableNext } from "./roles-table-next";

/**
 * The AdminCP roles list, as this application's Server Component.
 *
 * Reads the page with the request's own cookies and hands it to the shared
 * table. The columns, the members link, the edit dialog and the whole delete
 * flow are `RolesAdminTableContent`, which the TanStack AdminCP renders too.
 */
export const RolesAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = normalizeAdminRolesParams(await searchParams);
  const res = await fetcher(adminModule, adminRolesRequest(params));

  if (res.status !== 200) {
    return notFound();
  }

  return <RolesAdminTableNext data={await res.json()} />;
};
