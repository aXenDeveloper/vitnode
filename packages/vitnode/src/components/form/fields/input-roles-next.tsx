"use client";

import type { AutoFormRolesProps } from "./input-roles";
import type { RoleSearch } from "./roles";

import { AutoFormRoles } from "./input-roles";
import { searchRoles } from "./search-roles.action.server";

/**
 * {@link AutoFormRoles}, wired to Next.js.
 *
 * The same field with the same props, plus the one thing the shared component
 * refuses to guess: where roles come from. `searchRoles` is a `"use server"`
 * action that reads Hono through Next's request scope, so it resolves in a
 * Next.js application and nowhere else - which is precisely why it is injected
 * here rather than defaulted inside the field.
 *
 * This is the same split the data table already has (`data-table.tsx` around
 * `content.tsx`) and for the same reason: one shared component, one Next.js
 * adapter, and the coupling written down in the adapter's name instead of hidden
 * in a default parameter.
 *
 * A caller may still pass its own `search` - the spread order below leaves it in
 * charge - which keeps this a convenience rather than a second contract.
 *
 * A TanStack host does not use this file. It hands the field
 * `searchAdminRolesInBrowser` from
 * `views/admin/views/core/users/roles/roles-query`, which reads the same Hono
 * endpoint straight from the browser.
 */
export const AutoFormRolesNext = ({
  search = searchRoles,
  ...props
}: Omit<AutoFormRolesProps, "search"> & { search?: RoleSearch }) => (
  <AutoFormRoles {...props} search={search} />
);
