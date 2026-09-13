import { useRouter } from "@tanstack/react-router";

import type { AdminUserSearch } from "@/views/admin/layouts/search/search-users";

import { SearchAdminContent } from "@/views/admin/layouts/search/search-content";

import { useAdminSearchNavItems } from "./nav";
import { readAdminUserSearch } from "./user-search";

export const AdminSearch = ({
  onNavigate,
  searchUsers = readAdminUserSearch,
}: {
  onNavigate?: (href: string) => void;
  searchUsers?: AdminUserSearch;
}) => {
  const router = useRouter();
  const items = useAdminSearchNavItems();

  return (
    <SearchAdminContent
      items={items}
      onNavigate={onNavigate ?? (href => void router.navigate({ to: href }))}
      searchUsers={searchUsers}
    />
  );
};
