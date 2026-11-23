import { cn } from "cn";
import { ArchiveIcon, MailIcon, MailOpenIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";

import type { NotificationItemView } from "./notifications-query";

import { NotificationAvatar } from "./notification-avatar";

export interface NotificationItemProps {
  item: NotificationItemView;
  onArchive?: (item: NotificationItemView) => void;
  onOpen: (item: NotificationItemView, options: { newTab: boolean }) => void;
  onToggleRead?: (item: NotificationItemView) => void;
  variant?: "compact" | "full";
}

export const isModifiedClick = (event: React.MouseEvent) =>
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey ||
  event.button !== 0;

const NotificationItemContent = ({
  item,
  variant,
}: {
  item: NotificationItemView;
  variant: NonNullable<NotificationItemProps["variant"]>;
}) => {
  const t = useTranslations("core.global.notifications");

  return (
    <>
      <NotificationAvatar
        item={item}
        surface={variant === "compact" ? "popover" : "background"}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-sm leading-relaxed text-pretty",
            item.unread
              ? "text-foreground font-medium"
              : "text-muted-foreground",
          )}
        >
          {item.title}
        </span>
        {item.body && variant === "full" ? (
          <span className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {item.body}
          </span>
        ) : null}
        <span className="text-muted-foreground text-xs">
          <DateFormat date={item.lastActivityAt} />
        </span>
      </span>
      {item.unread ? (
        <span className="flex shrink-0 items-center pt-2">
          <span aria-hidden className="bg-primary size-2 rounded-full" />
          <span className="sr-only">{t("unread")}</span>
        </span>
      ) : null}
    </>
  );
};

const NotificationItemActions = ({
  item,
  onArchive,
  onToggleRead,
}: Pick<NotificationItemProps, "item" | "onArchive" | "onToggleRead">) => {
  const t = useTranslations("core.global.notifications");
  const toggleReadLabel = item.unread ? t("mark_read") : t("mark_unread");

  return (
    <span className="flex shrink-0 items-center gap-1 p-1">
      {onToggleRead ? (
        <Button
          aria-label={toggleReadLabel}
          onClick={() => onToggleRead(item)}
          size="icon-sm"
          title={toggleReadLabel}
          variant="ghost"
        >
          {item.unread ? <MailOpenIcon /> : <MailIcon />}
        </Button>
      ) : null}
      {onArchive ? (
        <Button
          aria-label={t("archive")}
          onClick={() => onArchive(item)}
          size="icon-sm"
          title={t("archive")}
          variant="ghost"
        >
          <ArchiveIcon />
        </Button>
      ) : null}
    </span>
  );
};

const itemClassName =
  "hover:bg-accent focus-visible:ring-ring flex min-w-0 flex-1 items-start gap-3 rounded-md p-2 text-start outline-none focus-visible:ring-2";

export const NotificationItem = ({
  item,
  onArchive,
  onOpen,
  onToggleRead,
  variant = "full",
}: NotificationItemProps) => {
  const content = <NotificationItemContent item={item} variant={variant} />;

  return (
    <li
      className={cn(
        "flex items-start gap-1 rounded-lg",
        item.unread && "bg-primary/5",
      )}
    >
      {item.target !== null ? (
        <a
          className={itemClassName}
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
          className={itemClassName}
          onClick={() => onOpen(item, { newTab: false })}
          type="button"
        >
          {content}
        </button>
      )}

      {variant === "full" && (onToggleRead || onArchive) ? (
        <NotificationItemActions
          item={item}
          onArchive={onArchive}
          onToggleRead={onToggleRead}
        />
      ) : null}
    </li>
  );
};
