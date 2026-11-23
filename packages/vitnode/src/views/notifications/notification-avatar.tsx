import { cn } from "cn";
import { createElement } from "react";

import { Avatar } from "@/components/avatar";

import type { NotificationItemView } from "./notifications-query";

import { notificationTypeIcon } from "./notification-type-icon";

export const NotificationAvatar = ({
  item,
  size = 36,
  surface = "popover",
}: {
  item: Pick<NotificationItemView, "actors" | "category" | "type">;
  size?: 36 | 40;
  surface?: "background" | "popover";
}) => {
  const actor = item.actors.at(0);
  const typeIcon = notificationTypeIcon(item);

  if (!actor) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full",
          size === 40 ? "size-10" : "size-9",
        )}
      >
        {createElement(typeIcon, { className: "size-4" })}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className="relative shrink-0">
      <Avatar alt="" size={size} user={actor} />
      <span
        className={cn(
          "bg-primary text-primary-foreground absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2",
          surface === "popover" ? "ring-popover" : "ring-background",
        )}
      >
        {createElement(typeIcon, { className: "size-2.5" })}
      </span>
    </span>
  );
};
