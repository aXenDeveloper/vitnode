import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/lib/fetcher";

import {
  adminUsersRequest,
  normalizeAdminUsersParams,
} from "./list/users-query";
import { UsersAdminTableNext } from "./list/users-table-next";

/**
 * The AdminCP users list, as this application's Server Component.
 *
 * What is left after Stage 12: read the page with the request's own cookies, and
 * hand it to the shared table. The columns, the empty state, the row actions and
 * the role filter are `UsersAdminTableContent`, which the TanStack AdminCP
 * renders too - so the two applications cannot drift apart in what a users list
 * *is*.
 *
 * The request goes through `normalizeAdminUsersParams` rather than straight to
 * `fetcher(..., { withPagination: true })`, and that is the second half of the
 * same idea: `?first=10` and no `first` are one request, `?roleId=abc` is not a
 * filter, and both applications agree on that because they run the same
 * function.
 */
export const UsersAdminView = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = normalizeAdminUsersParams(await searchParams);
  const res = await fetcher(adminModule, adminUsersRequest(params));
  const data = await res.json();

  return <UsersAdminTableNext data={data} />;
};
