"use client";

import { NextDataTableNavigation } from "@/components/table/navigation-next";
import { Link, useRouter } from "@/lib/navigation";

import type { AdminRoleFormProps } from "./role-form-content";
import type { AdminRolesPage } from "./roles-query";
import type { RolesAdminTableProps } from "./roles-table-content";

import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
} from "./roles-mutations.server";
import { searchAdminRolesInBrowser } from "./roles-query";
import {
  CreateRoleAction,
  RolesAdminTableContent,
} from "./roles-table-content";

/**
 * {@link RolesAdminTableContent} and its create button, wired to Next.js.
 *
 * The three writes are Server Actions, because each ends in `revalidatePath`.
 * The role search is a direct browser read shared with the TanStack AdminCP -
 * see `users/list/users-table-next.tsx` for why it stopped being an action.
 *
 * `router.refresh()` after a write because `revalidatePath` marks the cache
 * stale and the *current* render still has to be re-run: the dialog closes on a
 * page whose rows are the ones it just changed.
 */

const onSave: AdminRoleFormProps["onSave"] = async ({ id, values }) =>
  id === undefined
    ? await createRoleAction(values)
    : await updateRoleAction(id, values);

const onDelete: RolesAdminTableProps["onDelete"] = async args =>
  await deleteRoleAction(args);

export const RolesAdminTableNext = ({ data }: { data: AdminRolesPage }) => {
  const { refresh } = useRouter();

  return (
    <NextDataTableNavigation>
      <RolesAdminTableContent
        data={data}
        LinkComponent={Link}
        onDelete={onDelete}
        onSave={onSave}
        onSaved={refresh}
        searchRoles={searchAdminRolesInBrowser}
      />
    </NextDataTableNavigation>
  );
};

/** The header's create button, gated by the page. */
export const CreateRoleAdmin = () => {
  const { refresh } = useRouter();

  return <CreateRoleAction onSave={onSave} onSaved={refresh} />;
};
