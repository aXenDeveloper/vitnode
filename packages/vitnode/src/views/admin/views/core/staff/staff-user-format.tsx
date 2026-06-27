import { getLocale } from "next-intl/server";

import { Avatar } from "@/components/avatar";

interface StaffUserFormatProps {
  user: {
    avatarColor: string;
    name: string;
    nameCode: string;
    role: {
      color: null | string;
      id: number;
      name: { languageCode: string; name: string }[];
    };
  };
}

// Renders the staff entry's user with their role formatting — the name is
// coloured by the user's role, matching how `RoleFormat` resolves the label.
export const StaffUserFormat = async ({ user }: StaffUserFormatProps) => {
  const locale = await getLocale();
  const roleName =
    user.role.name.find(item => item.languageCode === locale)?.name ??
    user.role.name[0]?.name ??
    "";

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
