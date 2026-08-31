"use client";

import { useRouter } from "@tanstack/react-router";

import type { AdminUserSearch } from "@/views/admin/layouts/search/search-users";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SearchAdminContent } from "@/views/admin/layouts/search/search-content";

import { RouterLink } from "../layout/router-link";
import { useAdminSearchNavItems } from "./nav";

/**
 * The AdminCP command palette, on TanStack Start.
 *
 * Everything visible is `SearchAdminContent`'s - the same control and the same
 * dialog the Next.js AdminCP renders. What is here is the three things it
 * refuses to decide:
 *
 *     the index    ->  useAdminSearchNavItems()  the one filtered nav tree
 *     a link       ->  LinkComponent             the router's, or the host's
 *     a lookup     ->  searchUsers               the host's server function
 *
 * ## The index is a read, not a build
 *
 * `useAdminSearchNavItems` returns the flattening of the navigation the sidebar
 * is rendering, plus the explicitly-gated pages that are not in it. The palette
 * never assembles a tree of its own, so there is no second place a permission
 * filter could be forgotten - which is the failure that turns a search box into
 * a directory of every screen an admin cannot open.
 *
 * ## `searchUsers` is optional, and its absence is a real state
 *
 * A host that has not wired the admin user lookup yet passes nothing, and the
 * palette is pages-only: the users group never appears, and no request is made.
 * That is better than a stub that resolves to `[]`, which would render the "keep
 * typing" hint and then silently nothing, as though every query had no matches.
 */
export const AdminSearch = ({
  LinkComponent = RouterLink,
  onNavigate,
  searchUsers,
}: {
  LinkComponent?: AuthLinkComponent;
  /**
   * How the palette goes somewhere. Defaults to a plain router navigation; a
   * host passes its own when a destination needs preparing first - `apps/web`
   * de-localizes the href so the router is handed the spelling its tree uses.
   */
  onNavigate?: (href: string) => void;
  searchUsers?: AdminUserSearch;
}) => {
  const router = useRouter();
  const items = useAdminSearchNavItems();

  return (
    <SearchAdminContent
      items={items}
      LinkComponent={LinkComponent}
      onNavigate={onNavigate ?? (href => void router.navigate({ to: href }))}
      searchUsers={searchUsers}
    />
  );
};
