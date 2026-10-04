import { cn } from "cn";
import { ArchiveIcon, BellOffIcon, MailIcon, MailOpenIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";

import type { NotificationItemView } from "./notifications-query";

export interface NotificationItemProps {
  item: NotificationItemView;
  onArchive?: (item: NotificationItemView) => void;
  /**
   * Called on activation. It marks the item read and navigates; for a
   * modified click (new tab) the browser follows the link itself and this
   * only marks it read.
   */
  onOpen: (item: NotificationItemView, options: { newTab: boolean }) => void;
  onToggleRead?: (item: NotificationItemView) => void;
  variant?: "compact" | "full";
}

const isModifiedClick = (event: React.MouseEvent) =>
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey ||
  event.button !== 0;

export const NotificationItem = ({
  item,
  onArchive,
  onOpen,
  onToggleRead,
  variant = "full",
}: NotificationItemProps) => {
  const t = useTranslations("core.global.notifications");
  const actor = item.actors.at(0);
  const linkable = item.available && item.target !== null;

  const content = (
    <>
      <span className="relative shrink-0">
        {actor && item.available ? (
          <Avatar size={36} user={actor} />
        ) : (
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full"
          >
            {item.available ? (
              <MailIcon className="size-4" />
            ) : (
              <BellOffIcon className="size-4" />
            )}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            "text-sm leading-relaxed text-pretty",
            item.unread
              ? "text-foreground font-medium"
              : "text-muted-foreground",
            !item.available && "italic",
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

  const itemClassName =
    "hover:bg-accent focus-visible:ring-ring flex min-w-0 flex-1 items-start gap-3 rounded-md p-2 text-start outline-none focus-visible:ring-2";

  return (
    <li
      className={cn(
        "flex items-start gap-1 rounded-lg",
        item.unread && "bg-primary/5",
      )}
    >
      {linkable ? (
        <a
          className={itemClassName}
          href={item.target ?? undefined}
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
        <span className="flex shrink-0 items-center gap-1 p-1">
          {onToggleRead ? (
            <Button
              aria-label={item.unread ? t("mark_read") : t("mark_unread")}
              onClick={() => onToggleRead(item)}
              size="icon-sm"
              title={item.unread ? t("mark_read") : t("mark_unread")}
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
      ) : null}
    </li>
  );
};
