import { Link } from "@tanstack/react-router";
import { BellIcon, CheckCheckIcon, Settings2Icon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import type { NotificationItemProps } from "./notification-item";
import type { NotificationItemView } from "./notifications-query";

import { NotificationItem } from "./notification-item";

const NOTIFICATIONS_HREF = "/notifications";
export const NOTIFICATION_SETTINGS_HREF = "/settings/notifications";

const formatUnreadBadge = (count: number): null | string => {
  if (count <= 0) return null;

  return count > 99 ? "99+" : String(count);
};

export interface NotificationsBellContentProps {
  onMarkAllRead: () => void;
  onOpenChange: (open: boolean) => void;
  onOpenItem: NotificationItemProps["onOpen"];
  onRetry: () => void;
  open: boolean;
  recent: {
    isError: boolean;
    isPending: boolean;
    items: NotificationItemView[] | undefined;
  };
  unread: number;
}

export const NotificationsBellContent = ({
  onMarkAllRead,
  onOpenChange,
  onOpenItem,
  onRetry,
  open,
  recent,
  unread,
}: NotificationsBellContentProps) => {
  const t = useTranslations("core.global.notifications");
  const badge = formatUnreadBadge(unread);

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={
              unread > 0
                ? t("bell_label_unread", { count: unread })
                : t("bell_label")
            }
            className="relative"
            size="icon"
            variant="ghost"
          />
        }
      >
        <BellIcon />
        {badge ? (
          <span
            aria-hidden
            className="bg-destructive absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs leading-none font-semibold text-white tabular-nums"
            data-testid="notifications-badge"
          >
            {badge}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 gap-2 p-2 sm:w-96">
        <div className="flex items-center justify-between gap-2 px-2 pt-1">
          <PopoverTitle className="text-base">{t("title")}</PopoverTitle>
          <Button
            disabled={unread === 0}
            onClick={onMarkAllRead}
            size="sm"
            variant="ghost"
          >
            <CheckCheckIcon />
            {t("mark_all_read")}
          </Button>
        </div>

        <div aria-busy={recent.isPending} className="max-h-96 overflow-y-auto">
          {recent.isPending ? (
            <div className="flex flex-col gap-2 p-2" role="status">
              <span className="sr-only">{t("loading")}</span>
              {Array.from({ length: 3 }, (_, index) => (
                <div className="flex items-start gap-3" key={index}>
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.isError ? (
            <div
              className="flex flex-col items-center gap-2 p-4 text-center"
              role="alert"
            >
              <p className="text-muted-foreground text-sm">{t("load_error")}</p>
              <Button onClick={onRetry} size="sm" variant="outline">
                {t("retry")}
              </Button>
            </div>
          ) : recent.items && recent.items.length > 0 ? (
            <ul aria-label={t("recent")} className="flex flex-col gap-1">
              {recent.items.map(item => (
                <NotificationItem
                  item={item}
                  key={item.id}
                  onOpen={onOpenItem}
                  variant="compact"
                />
              ))}
            </ul>
          ) : (
            <Empty className="p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellIcon />
                </EmptyMedia>
                <EmptyTitle>{t("empty_title")}</EmptyTitle>
                <EmptyDescription>{t("empty_desc")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-1 pt-2">
          <Button
            nativeButton={false}
            onClick={() => onOpenChange(false)}
            render={<Link to={NOTIFICATIONS_HREF} />}
            size="sm"
            variant="ghost"
          >
            {t("view_all")}
          </Button>
          <Button
            aria-label={t("settings")}
            nativeButton={false}
            onClick={() => onOpenChange(false)}
            render={<Link to={NOTIFICATION_SETTINGS_HREF} />}
            size="icon-sm"
            title={t("settings")}
            variant="ghost"
          >
            <Settings2Icon />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
