import { cookies } from "next/headers";

import { AdminStaffPermissionProvider } from "@/components/staff-permission/provider";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";

import type { VitNodeConfig } from "../../../vitnode.config";

import { I18nProvider } from "../../../components/i18n-provider";
import { getSearchNavItems } from "./search/get-search-nav-items";
import { SearchAdmin } from "./search/search";
import { getAdminNav } from "./sidebar/nav/get-admin-nav";
import { SidebarAdmin } from "./sidebar/sidebar";
import { UserBarAdmin } from "./user-bar/user-bar";

export interface AdminLayoutProps {
  /** `@breadcrumb` parallel-route slot rendered in the header. */
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
}

export const AdminLayout = async ({
  children,
  breadcrumb,
  vitNodeConfig,
}: AdminLayoutProps & {
  vitNodeConfig: VitNodeConfig;
}) => {
  const session = await getSessionAdminApi();
  const cookieStore = await cookies();
  const defaultOpen =
    !cookieStore.get("vitnode_admin_sidebar_state") ||
    cookieStore.get("vitnode_admin_sidebar_state")?.value === "true";
  if (!session) return null;

  const nav = await getAdminNav({ vitNodeConfig });
  const searchItems = await getSearchNavItems({ nav, vitNodeConfig });

  return (
    <I18nProvider namespaces={["admin.global"]}>
      <AdminStaffPermissionProvider value={session.permissions}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SidebarAdmin nav={nav} vitNodeConfig={vitNodeConfig} />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1 shrink-0" />
              {breadcrumb != null && (
                <>
                  <Separator
                    className="mr-1 h-4 shrink-0"
                    orientation="vertical"
                  />
                  <div className="min-w-0 flex-1">{breadcrumb}</div>
                </>
              )}

              <div className="ml-auto flex shrink-0 items-center justify-center gap-2 px-2">
                <SearchAdmin items={searchItems} />

                <UserBarAdmin user={session.user} />
              </div>
            </header>
            {children}
          </SidebarInset>
        </SidebarProvider>
      </AdminStaffPermissionProvider>
    </I18nProvider>
  );
};
