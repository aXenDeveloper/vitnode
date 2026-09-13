import type { AvatarUser } from "./avatar";

import { Avatar } from "./avatar";

export const UserMenuIdentity = ({
  user,
}: {
  user: AvatarUser & { email: string };
}) => (
  <>
    <Avatar className="size-8" size={32} user={user} />

    <div className="grid flex-1 text-start text-sm leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="text-muted-foreground truncate text-xs">
        {user.email}
      </span>
    </div>
  </>
);
