import type { AdminUserSearch } from "@vitnode/core/tanstack/admin";

import { AdminShellContent } from "@vitnode/core/tanstack/admin";
import { LanguageSwitcher } from "@vitnode/core/tanstack/layout";

import { adminNav } from "#/lib/admin-nav";
import { adminUserSearchFn } from "#/lib/admin-search";
import { useAppNavigate } from "#/lib/navigation";


const searchUsers: AdminUserSearch = async search =>
  await adminUserSearchFn({ data: { search } });

export const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const navigate = useAppNavigate();

  return (
    <AdminShellContent
      languageSwitcher={<LanguageSwitcher />}
      nav={adminNav}
      onNavigate={href => {
        void navigate(href);
      }}
      searchUsers={searchUsers}
    >
      {children}
    </AdminShellContent>
  );
};
