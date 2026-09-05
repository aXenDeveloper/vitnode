"use client";

import { useRouter } from "@tanstack/react-router";

import type { AdminUserSearch } from "@/views/admin/layouts/search/search-users";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { SearchAdminContent } from "@/views/admin/layouts/search/search-content";

import { RouterLink } from "../layout/router-link";
import { useAdminSearchNavItems } from "./nav";

export const AdminSearch = ({
  LinkComponent = RouterLink,
  onNavigate,
  searchUsers,
}: {
  LinkComponent?: AuthLinkComponent;

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
