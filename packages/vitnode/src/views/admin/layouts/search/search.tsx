"use client";

import { Link, useRouter } from "@/lib/navigation";

import type { AdminSearchNavItem } from "./flatten-nav";

import { SearchAdminContent } from "./search-content";
import { searchUsersForAdminPalette } from "./search-users.action.server";

/**
 * {@link SearchAdminContent}, wired to Next.js.
 *
 * `searchUsersForAdminPalette` is named here rather than inside the lazy chunk
 * so this file stays the one place the Server Action is referenced; the chunk
 * itself receives it as a prop and knows nothing about Next.
 */
export const SearchAdmin = ({ items }: { items: AdminSearchNavItem[] }) => {
  const { push } = useRouter();

  return (
    <SearchAdminContent
      items={items}
      LinkComponent={Link}
      onNavigate={push}
      searchUsers={searchUsersForAdminPalette}
    />
  );
};
