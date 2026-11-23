import type { ContentPublicPerson } from "@vitnode/api/content/public-person";

import { cn } from "cn";
import { UsersRoundIcon } from "lucide-react";

import { Avatar } from "@/components/avatar";

/**
 * A chat's picture: the other person in a direct chat, two overlapping
 * avatars in a group. Decorative - the chat's name is always next to it.
 */
export const ChatAvatar = ({
  className,
  kind,
  members,
  size = 40,
}: {
  className?: string;
  kind: "direct" | "group";
  members: ContentPublicPerson[];
  size?: number;
}) => {
  const [first, second] = members;
  if (kind === "direct" || !second) {
    return first ? (
      <Avatar
        alt=""
        className={cn("shrink-0", className)}
        size={size}
        user={first}
      />
    ) : (
      <span
        aria-hidden="true"
        className={cn(
          "bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full",
          className,
        )}
        style={{ height: size, width: size }}
      >
        <UsersRoundIcon className="size-1/2" />
      </span>
    );
  }
  const small = Math.round(size * 0.7);

  return (
    <span
      aria-hidden="true"
      className={cn("relative block shrink-0", className)}
      style={{ height: size, width: size }}
    >
      <Avatar
        alt=""
        className="absolute start-0 top-0"
        size={small}
        user={first}
      />
      <Avatar
        alt=""
        className="ring-background absolute end-0 bottom-0 ring-2"
        size={small}
        user={second}
      />
    </span>
  );
};

/** The name a chat shows: its title, or its members' names. */
export const chatDisplayName = ({
  members,
  title,
}: {
  members: Pick<ContentPublicPerson, "name">[];
  title: null | string;
}): string => title ?? members.map(member => member.name).join(", ");
