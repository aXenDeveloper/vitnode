"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, usePathname } from "@/lib/navigation";

export const StaffTabsAdmin = () => {
  const t = useTranslations("admin.staff.tabs");
  const pathname = usePathname();
  const value = pathname.includes("/staff/admins") ? "admins" : "moderators";

  return (
    <Tabs className="mb-4" value={value}>
      <TabsList>
        <TabsTrigger
          nativeButton={false}
          render={<Link href="/admin/core/users/staff/moderators" />}
          value="moderators"
        >
          {t("moderators")}
        </TabsTrigger>
        <TabsTrigger
          nativeButton={false}
          render={<Link href="/admin/core/users/staff/admins" />}
          value="admins"
        >
          {t("admins")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
