"use client";

import { NextDataTableNavigation } from "@/components/table/navigation-next";
import { Link } from "@/lib/navigation";

import type { AdminUsersPage } from "./users-query";
import type { VerifyAdminUserEmail } from "./users-table-content";

import { searchAdminRolesInBrowser } from "../roles/roles-query";
import { UsersAdminTableContent } from "./users-table-content";
import { verifyEmailAction } from "./verify-email.server";

/**
 * {@link UsersAdminTableContent}, wired to Next.js.
 *
 * The table is shared with the TanStack AdminCP; this supplies the three things
 * that differ, and nothing else:
 *
 *     LinkComponent   `next-intl`'s locale-aware `Link`
 *     onVerifyEmail   a Server Action, because the refresh is `revalidatePath`
 *     searchRoles     a direct browser read - see below
 *
 * A client component rather than a Server Component, and it has to be: the
 * table's `cell` functions render `RoleFormatContent`, which reads the locale
 * from `use-intl`'s context, and the navigation provider below is a client
 * component too. The page above it stays a Server Component and hands the
 * fetched page down.
 *
 * ## Why the role search is not a Server Action any more
 *
 * It was one - `search-roles.action.server.tsx` - and there were three of them
 * across this screen, the user page and the delete dialog, each fetching
 * `/admin/roles/list` and mapping the result its own way. A Server Action cannot
 * be called from a TanStack Start route, and re-declaring it as a server
 * function would put a second RPC hop in front of a plain authenticated `GET`
 * that the browser can make itself.
 *
 * So both applications call Hono directly through
 * {@link searchAdminRolesInBrowser}, and the guest-role rule that all three
 * copies wanted is stated once, in `adminRoleOptionsFrom`. The read is a `GET`,
 * so it is not behind the CSRF guard, and `credentials: "include"` carries the
 * admin cookie to an API on another origin - which `apps/api` allows with
 * `cors: { credentials: true }`.
 */
/**
 * Module scope, not inside the component: it is a prop on a table that
 * re-renders on every navigation, and a new function identity per render would
 * remount the button it belongs to.
 */
const onVerifyEmail: VerifyAdminUserEmail = async id =>
  await verifyEmailAction(id);

export const UsersAdminTableNext = ({ data }: { data: AdminUsersPage }) => (
  <NextDataTableNavigation>
    <UsersAdminTableContent
      data={data}
      LinkComponent={Link}
      onVerifyEmail={onVerifyEmail}
      searchRoles={searchAdminRolesInBrowser}
    />
  </NextDataTableNavigation>
);
