import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { staffPermissionKey } from "@/api/lib/staff-permission";
import { adminModule } from "@/api/modules/admin/admin.module";
import { staffPermissionModuleByType } from "@/api/modules/admin/staff/lib/schema";
import { RoleFormat } from "@/components/role-format";
import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { notFound } from "@/framework/navigation";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { fetcher } from "@/lib/fetcher";
import { Link } from "@/lib/navigation";

import { StaffUserFormat } from "../table/staff-user-format";
import { EditStaffPermissionsForm } from "./form";

interface EditStaffPermissionsViewProps {
  id: string;
  type: PermissionStaffType;
}

export const EditStaffPermissionsView = async ({
  type,
  id,
}: EditStaffPermissionsViewProps) => {
  const canEdit = await checkAdminPermissionApi({
    module: staffPermissionModuleByType[type],
    permission: "can_edit",
  });

  if (!canEdit) {
    notFound();
  }

  const t = await getTranslations("admin.staff.edit");
  const tRoot = (await getTranslations()) as unknown as ((
    key: string,
  ) => string) & {
    has: (key: string) => boolean;
  };

  const [catalogRes, entryRes] = await Promise.all([
    fetcher(adminModule, {
      path: "/permission-catalog",
      method: "get",
      module: "admin/staff",
    }),
    fetcher(adminModule, {
      path: "/entry/{type}/{id}",
      method: "get",
      module: "admin/staff",
      args: { params: { type, id } },
    }),
  ]);

  if (entryRes.status !== 200 || catalogRes.status !== 200) {
    notFound();
  }

  const catalog = await catalogRes.json();
  const entry = await entryRes.json();

  const granted = new Set(
    entry.permissions.map(permission => staffPermissionKey(permission)),
  );

  // Resolve every label on the server so the client form only deals with
  // ready-to-render strings.
  const plugins = catalog
    .map(plugin => {
      const modules = Object.entries(plugin[type])
        .map(([module, permissions]) => ({
          module,
          label: tRoot.has(`${plugin.pluginId}:${module}`)
            ? tRoot(`${plugin.pluginId}:${module}`)
            : module,
          permissions: permissions.map(entry => {
            const args = {
              plugin: plugin.pluginId,
              module,
              permission: entry.permission,
            };
            const key = staffPermissionKey(args);

            return {
              ...args,
              key,
              checked: granted.has(key),
              label: tRoot.has(key) ? tRoot(key) : entry.permission,
              // The keys of the permissions this one depends on - the form
              // keeps it hidden until every one of them is enabled.
              dependsOn: entry.dependsOn.map(dependency =>
                staffPermissionKey({
                  plugin: plugin.pluginId,
                  module,
                  permission: dependency,
                }),
              ),
            };
          }),
        }))
        .filter(module => module.permissions.length > 0);

      return {
        pluginId: plugin.pluginId,
        label: tRoot.has(`${plugin.pluginId}.title`)
          ? tRoot(`${plugin.pluginId}.title`)
          : plugin.pluginId,
        modules,
      };
    })
    .filter(plugin => plugin.modules.length > 0);

  const backHref =
    type === "admin"
      ? "/admin/core/staff/admins"
      : "/admin/core/staff/moderators";

  return (
    <>
      <HeaderContent
        desc={
          <div className="flex items-center gap-2">
            {t("subject")}
            {entry.role ? (
              <RoleFormat role={entry.role} />
            ) : entry.user ? (
              <StaffUserFormat user={entry.user} />
            ) : null}
          </div>
        }
        h1={t("title")}
      >
        <Button
          nativeButton={false}
          render={<Link href={backHref} />}
          variant="outline"
        >
          <ArrowLeftIcon />
          {t("back")}
        </Button>
      </HeaderContent>

      {entry.protected ? (
        <p className="text-muted-foreground">{t("protected")}</p>
      ) : entry.self ? (
        <p className="text-muted-foreground">{t("self")}</p>
      ) : (
        <EditStaffPermissionsForm
          id={id}
          plugins={plugins}
          type={type}
          unrestricted={entry.unrestricted}
        />
      )}
    </>
  );
};
