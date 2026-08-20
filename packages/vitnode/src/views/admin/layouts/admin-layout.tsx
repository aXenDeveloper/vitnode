import { Suspense } from "react";

import { AdminStaffPermissionProvider } from "@/components/staff-permission/provider";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";

import type { VitNodeConfig } from "../../../vitnode.config";

import { I18nProvider } from "../../../components/i18n-provider";
import { getSearchNavItems } from "./search/get-search-nav-items";
import { SearchAdmin } from "./search/search";
import { getAdminNav } from "./sidebar/nav/get-admin-nav";
import { NavSidebarAdmin } from "./sidebar/nav/nav";
import { NavSidebarAdminSkeleton } from "./sidebar/nav/nav-skeleton";
import { SidebarAdmin } from "./sidebar/sidebar";
import { UserBarAdmin } from "./user-bar/user-bar";

export interface AdminLayoutProps {
  /** `@breadcrumb` parallel-route slot rendered in the header. */
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
}

const AdminStaffPermissionScope = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const session = await getSessionAdminApi();

  return (
    <AdminStaffPermissionProvider
      value={session?.permissions ?? { root: false, permissions: [] }}
    >
      {children}
    </AdminStaffPermissionProvider>
  );
};

const NavSidebarAdminSession = async ({
  vitNodeConfig,
}: {
  vitNodeConfig: VitNodeConfig;
}) => <NavSidebarAdmin nav={await getAdminNav({ vitNodeConfig })} />;

const SearchAdminSession = async ({
  vitNodeConfig,
}: {
  vitNodeConfig: VitNodeConfig;
}) => {
  const nav = await getAdminNav({ vitNodeConfig });

  return (
    <SearchAdmin items={await getSearchNavItems({ nav, vitNodeConfig })} />
  );
};

const UserBarAdminSession = async () => {
  const session = await getSessionAdminApi();
  if (!session) return null;

  return <UserBarAdmin user={session.user} />;
};

const ContentAdminSkeleton = () => (
  <div className="space-y-6 p-4">
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
    <Skeleton className="h-72 w-full" />
  </div>
);

export const AdminLayout = ({
  children,
  breadcrumb,
  vitNodeConfig,
}: AdminLayoutProps & {
  vitNodeConfig: VitNodeConfig;
}) => {
  return (
    <I18nProvider namespaces={["admin.global"]}>
      <SidebarProvider>
        <SidebarAdmin vitNodeConfig={vitNodeConfig}>
          <Suspense fallback={<NavSidebarAdminSkeleton />}>
            <NavSidebarAdminSession vitNodeConfig={vitNodeConfig} />
          </Suspense>
        </SidebarAdmin>
        <SidebarInset>
          <header className="bg-background sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b px-4">
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
              <Suspense
                fallback={
                  <>
                    <Skeleton className="size-8 sm:hidden" />
                    <Skeleton className="hidden h-9 w-42 sm:block xl:w-64" />
                  </>
                }
              >
                <AdminStaffPermissionScope>
                  <SearchAdminSession vitNodeConfig={vitNodeConfig} />
                </AdminStaffPermissionScope>
              </Suspense>

              <Suspense fallback={<Skeleton className="size-9" />}>
                <AdminStaffPermissionScope>
                  <UserBarAdminSession />
                </AdminStaffPermissionScope>
              </Suspense>
            </div>
          </header>

          <Suspense fallback={<ContentAdminSkeleton />}>
            <AdminStaffPermissionScope>{children}</AdminStaffPermissionScope>
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </I18nProvider>
  );
};
