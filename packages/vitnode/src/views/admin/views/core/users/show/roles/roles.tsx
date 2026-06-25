import { UsersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { RoleFormat } from "@/components/role-format";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Role } from "./search-roles.action";

import { EditRoles } from "./edit-roles";

export const RolesUserAdmin = async ({
  nameCode,
  role,
  secondaryRoles,
}: {
  nameCode: string;
  role: Role;
  secondaryRoles: Role[];
}) => {
  const t = await getTranslations("admin.user.show");

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="text-muted-foreground size-5" />
          {t("rolesTitle")}
        </CardTitle>
        <CardAction>
          <EditRoles
            nameCode={nameCode}
            primaryRole={role}
            secondaryRoles={secondaryRoles}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">
            {t("primaryRole")}
          </span>
          <RoleFormat role={role} />
        </div>

        {secondaryRoles.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">
              {t("secondaryRoles")}
            </span>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {secondaryRoles.map(item => (
                <RoleFormat key={item.id} role={item} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
