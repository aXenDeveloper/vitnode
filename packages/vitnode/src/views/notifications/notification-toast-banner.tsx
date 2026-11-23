import { cn } from "cn";

import { DateFormat } from "@/components/date-format";

import type { NotificationItemView } from "./notifications-query";

import { NotificationAvatar } from "./notification-avatar";

export const NOTIFICATION_TOAST_CLASS_NAME =
  "rounded-2xl! p-3! bg-popover/70! backdrop-blur-xl! backdrop-saturate-150! [&>[data-close-button]]:z-10";

const splitTitle = (item: NotificationItemView) => {
  const actor = item.actors.at(0);
  if (!actor || item.actorCount > 1 || !item.title.startsWith(actor.name)) {
    return { detail: null, heading: item.title };
  }

  const rest = item.title.slice(actor.name.length).trim();
  if (!rest) return { detail: null, heading: item.title };

  return {
    detail: rest.charAt(0).toLocaleUpperCase() + rest.slice(1),
    heading: actor.name,
  };
};

export const NotificationToastBanner = ({
  item,
  onOpen,
}: {
  item: NotificationItemView;
  onOpen: () => void;
}) => {
  const { detail, heading } = splitTitle(item);

  return (
    <button
      className="focus-visible:ring-ring/50 relative flex w-full cursor-pointer items-start gap-3 rounded-xl text-start font-normal outline-none after:absolute after:-inset-3 focus-visible:ring-3"
      onClick={onOpen}
      type="button"
    >
      <NotificationAvatar item={item} size={40} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "text-sm leading-5 font-semibold text-pretty",
              detail ? "truncate" : "line-clamp-2",
            )}
          >
            {heading}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">
            <DateFormat date={item.lastActivityAt} />
          </span>
        </span>
        {detail ? (
          <span className="text-sm leading-5 text-pretty">{detail}</span>
        ) : null}
        {item.body ? (
          <span className="text-muted-foreground line-clamp-2 text-sm leading-5 text-pretty">
            {item.body}
          </span>
        ) : null}
      </span>
    </button>
  );
};
