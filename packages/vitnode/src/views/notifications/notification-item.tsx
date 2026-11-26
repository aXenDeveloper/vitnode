import { cn } from "cn";
import { ArchiveIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type { NotificationItemView } from "./notifications-query";

import { NotificationAvatar } from "./notification-avatar";
import { splitNotificationTitle } from "./notification-title";

export interface NotificationItemProps {
  item: NotificationItemView;
  onArchive: (item: NotificationItemView) => void;
  onOpen: (item: NotificationItemView, options: { newTab: boolean }) => void;
  onToggleRead: (item: NotificationItemView) => void;
}

export const isModifiedClick = (event: React.MouseEvent) =>
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey ||
  event.button !== 0;

const NotificationTitle = ({ item }: { item: NotificationItemView }) => {
  const parts = React.useMemo(
    () =>
      splitNotificationTitle(
        item.title,
        item.actors.map(actor => actor.name),
      ),
    [item.actors, item.title],
  );

  return (
    <span
      className={cn(
        "line-clamp-2 text-sm leading-relaxed text-pretty",
        item.unread ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {parts.map(part =>
        part.emphasis ? (
          <strong
            className={cn(
              "text-foreground",
              item.unread ? "font-semibold" : "font-medium",
            )}
            key={part.start}
          >
            {part.text}
          </strong>
        ) : (
          <React.Fragment key={part.start}>{part.text}</React.Fragment>
        ),
      )}
    </span>
  );
};

const NotificationItemContent = ({ item }: { item: NotificationItemView }) => {
  const t = useTranslations("core.global.notifications");

  return (
    <>
      <NotificationAvatar item={item} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <NotificationTitle item={item} />
        <span className="text-muted-foreground text-xs">
          <DateFormat date={item.lastActivityAt} />
        </span>
      </span>
      {item.unread ? <span className="sr-only">{t("unread")}</span> : null}
    </>
  );
};

const NotificationItemControls = ({
  item,
  onArchive,
  onToggleRead,
}: Pick<NotificationItemProps, "item" | "onArchive" | "onToggleRead">) => {
  const t = useTranslations("core.global.notifications");
  const toggleReadLabel = item.unread ? t("mark_read") : t("mark_unread");

  return (
    <span className="absolute end-1.5 top-1.5 flex items-center gap-0.5">
      <TooltipWithContent text={t("archive")}>
        <Button
          aria-label={t("archive")}
          className="opacity-0 transition-opacity duration-150 group-focus-within/row:opacity-100 group-hover/row:opacity-100 motion-reduce:transition-none pointer-coarse:size-10 pointer-coarse:opacity-100"
          onClick={() => onArchive(item)}
          size="icon-sm"
          variant="ghost"
        >
          <ArchiveIcon />
        </Button>
      </TooltipWithContent>
      <TooltipWithContent text={toggleReadLabel}>
        <Button
          aria-label={toggleReadLabel}
          className="group/dot hover:bg-transparent pointer-coarse:size-10"
          onClick={() => onToggleRead(item)}
          size="icon-sm"
          variant="ghost"
        >
          <span
            aria-hidden
            className={cn(
              "ease-fluid size-2.5 rounded-full transition-[scale,background-color,box-shadow,opacity] duration-150 group-hover/dot:scale-125 motion-reduce:transition-none",
              item.unread
                ? "bg-primary"
                : "inset-ring-muted-foreground/70 opacity-0 inset-ring group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100",
            )}
          />
        </Button>
      </TooltipWithContent>
    </span>
  );
};

const itemClassName =
  "focus-visible:ring-ring flex w-full min-w-0 items-start gap-3 rounded-md py-2 ps-2 pe-20 text-start transition-[background-color,scale] outline-none focus-visible:ring-2 active:scale-99 hover:bg-accent group-data-glide/feed:hover:bg-transparent group-data-glide/feed:active:scale-100";

/**
 * One notification in the bell dropdown. Opening it is a link to its target
 * (a button when it has none) with the actors and the quoted subject
 * emphasized. The dot toggles read state; the archive button removes it.
 */
export const NotificationItem = ({
  item,
  onArchive,
  onOpen,
  onToggleRead,
}: NotificationItemProps) => {
  const content = <NotificationItemContent item={item} />;
  const className = cn(itemClassName, item.unread && "bg-primary/5");

  return (
    <div className="group/row relative pb-1">
      {item.target !== null ? (
        <a
          className={className}
          data-sidebar="menu-button"
          href={item.target}
          onClick={event => {
            const newTab = isModifiedClick(event);
            if (!newTab) event.preventDefault();
            onOpen(item, { newTab });
          }}
        >
          {content}
        </a>
      ) : (
        <button
          className={className}
          data-sidebar="menu-button"
          onClick={() => onOpen(item, { newTab: false })}
          type="button"
        >
          {content}
        </button>
      )}
      <NotificationItemControls
        item={item}
        onArchive={onArchive}
        onToggleRead={onToggleRead}
      />
    </div>
  );
};
