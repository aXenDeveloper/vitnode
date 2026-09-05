"use client";

import { useLocale } from "use-intl";

import type { RoleNameEntry } from "@/components/role-name";

import { Avatar } from "@/components/avatar";
import { resolveRoleName } from "@/components/role-name";

export const StaffUserFormatContent = ({
  user,
}: {
  user: {
    avatarColor: string;
    name: string;
    nameCode: string;
    role: { color: null | string; id: number; name: RoleNameEntry[] };
  };
}) => {
  const locale = useLocale();
  const roleName = resolveRoleName(user.role, locale);

  return (
    <div className="flex items-center gap-3">
      <Avatar size={32} user={user} />

      <div className="flex flex-col">
        <span
          className="font-medium"
          style={user.role.color ? { color: user.role.color } : undefined}
        >
          {user.name}
        </span>
        <span className="text-muted-foreground text-sm">
          @{user.nameCode}
          {roleName ? ` · ${roleName}` : ""}
        </span>
      </div>
    </div>
  );
};
