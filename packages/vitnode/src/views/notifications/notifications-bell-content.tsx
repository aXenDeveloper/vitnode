import type React from "react";

import { Link } from "@tanstack/react-router";
import { BellIcon, CheckCheckIcon, Settings2Icon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipGroup, TooltipWithContent } from "@/components/ui/tooltip";

import type { NotificationsFeedFilter } from "./notifications-query";

import { MarkAllReadConfirm } from "./mark-all-read-confirm";
import { NOTIFICATIONS_FEED_FILTERS } from "./notifications-query";
import { UnreadCountBadge } from "./unread-count-badge";

export const NOTIFICATION_SETTINGS_HREF = "/settings/notifications";

const FRAME_BUTTON_CLASS_NAME = "hover:bg-popover dark:hover:bg-popover";

export interface NotificationsBellContentProps {
  filter: NotificationsFeedFilter;
  onFilterChange: (filter: NotificationsFeedFilter) => void;
  onMarkAllRead: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  renderFeed: (filter: NotificationsFeedFilter) => React.ReactNode;
  unread: number;
}

export const NotificationsBellContent = ({
  filter,
  onFilterChange,
  onMarkAllRead,
  onOpenChange,
  open,
  renderFeed,
  unread,
}: NotificationsBellContentProps) => {
  const t = useTranslations("core.global.notifications");

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
        <UnreadCountBadge
          className="bg-destructive absolute -end-0.5 -top-0.5 h-4 min-w-4 rounded-full px-1 text-xs leading-none font-semibold text-white tabular-nums"
          count={unread}
          testId="notifications-badge"
        />
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="bg-muted ring-border w-[calc(100vw-2rem)] gap-1 p-1 backdrop-blur-none sm:w-96"
      >
        <TooltipGroup>
          <Tabs
            className="gap-1"
            onValueChange={value =>
              onFilterChange(value as NotificationsFeedFilter)
            }
            value={filter}
          >
            <div className="flex items-center justify-between gap-2 ps-3.5 pe-1 pt-0.5">
              <PopoverTitle className="text-base">{t("title")}</PopoverTitle>
              <TooltipWithContent text={t("settings")}>
                <Button
                  aria-label={t("settings")}
                  className={FRAME_BUTTON_CLASS_NAME}
                  nativeButton={false}
                  onClick={() => onOpenChange(false)}
                  render={<Link to={NOTIFICATION_SETTINGS_HREF} />}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Settings2Icon />
                </Button>
              </TooltipWithContent>
            </div>
            <TabsList
              aria-label={t("filters_label")}
              className="w-full bg-transparent"
            >
              {NOTIFICATIONS_FEED_FILTERS.map(value => (
                <TabsTrigger key={value} value={value}>
                  {t(`filter.${value}`)}
                  {value === "unread" ? (
                    <UnreadCountBadge
                      className="bg-foreground/10 text-foreground h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums"
                      count={unread}
                    />
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="bg-popover ring-border relative h-112 max-h-[60dvh] overflow-hidden rounded-lg shadow-xs ring-1">
              {NOTIFICATIONS_FEED_FILTERS.map(value => (
                <TabsContent className="h-full" key={value} value={value}>
                  {renderFeed(value)}
                </TabsContent>
              ))}
            </div>
          </Tabs>

          <div className="flex items-center justify-end gap-2 px-1 pb-0.5">
            <MarkAllReadConfirm onConfirm={onMarkAllRead} unread={unread}>
              <Button
                className={FRAME_BUTTON_CLASS_NAME}
                disabled={unread === 0}
                size="sm"
                variant="ghost"
              >
                <CheckCheckIcon />
                {t("mark_all_read")}
              </Button>
            </MarkAllReadConfirm>
          </div>
        </TooltipGroup>
      </PopoverContent>
    </Popover>
  );
};
