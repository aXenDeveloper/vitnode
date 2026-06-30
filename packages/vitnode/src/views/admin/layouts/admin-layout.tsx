import { cookies } from "next/headers";

import { StaffPermissionProvider } from "@/components/staff-permission/provider";
import { ThemeSwitcher } from "@/components/switchers/themes/theme-switcher";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";

import type { VitNodeConfig } from "../../../vitnode.config";

import { I18nProvider } from "../../../components/i18n-provider";
import { LanguageSwitcher } from "../../../components/switchers/langs/language-switcher";
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

  return (
    <I18nProvider namespaces={["admin.global"]}>
      <StaffPermissionProvider value={session.permissions}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SidebarAdmin vitNodeConfig={vitNodeConfig} />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              {breadcrumb != null && (
                <>
                  <Separator className="mr-1 h-4" orientation="vertical" />
                  {breadcrumb}
                </>
              )}

              <div className="ml-auto flex items-center justify-center gap-2 px-2">
                {vitNodeConfig.i18n.locales.length > 1 && (
                  <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
                )}
                <ThemeSwitcher />
                <UserBarAdmin user={session.user} />
              </div>
            </header>
            {children}
          </SidebarInset>
        </SidebarProvider>
      </StaffPermissionProvider>
    </I18nProvider>
  );
};
