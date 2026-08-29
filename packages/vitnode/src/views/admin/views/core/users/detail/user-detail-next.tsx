"use client";

import { Link } from "@/lib/navigation";
import { searchAdminRolesInBrowser } from "@/views/admin/views/core/users/roles/roles-query";
import { SearchFeed } from "@/views/search/search-feed";

import type { AdminUserDetail } from "./user-query";

import { UserDetailContent } from "./user-detail-content";
import { updateUserAction } from "./user-mutations.server";

/**
 * {@link UserDetailContent}, wired to Next.js.
 *
 * Three bindings: the two writes are one Server Action, the links are
 * `next-intl`'s locale-aware `Link`, and the timeline is the Next.js `SearchFeed`
 * - which reads the locale from `next-intl` and builds the same query the
 * TanStack route builds from its loader's.
 *
 * `canEdit` is decided by the Server Component above, from the same
 * `canEditAdminUser` predicate the TanStack route uses, so the two applications
 * show the same pencils to the same administrators.
 */
export const UserDetailNext = ({
  canEdit,
  user,
}: {
  canEdit: boolean;
  user: AdminUserDetail;
}) => (
  <UserDetailContent
    canEdit={canEdit}
    LinkComponent={Link}
    onUpdate={updateUserAction}
    onUpdateRoles={updateUserAction}
    searchRoles={searchAdminRolesInBrowser}
    timeline={
      <SearchFeed
        params={{ authorId: String(user.id), sort: "newest" }}
        variant="timeline"
      />
    }
    user={user}
  />
);
