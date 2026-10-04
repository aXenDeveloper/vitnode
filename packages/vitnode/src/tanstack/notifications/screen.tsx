import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
import { PageTitle } from "@/components/ui/page-title";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationItem } from "@/views/notifications/notification-item";
import { useNotificationState } from "@/views/notifications/notification-state-store";
import { NOTIFICATION_SETTINGS_HREF } from "@/views/notifications/notifications-bell-content";
import {
  notificationPreferencesQueryOptions,
  notificationsInfiniteQueryOptions,
} from "@/views/notifications/notifications-query";

import type { NotificationsRouteData } from "./route";
import type { NotificationsRouteSearch } from "./route-search";

import { RouteMessages } from "../i18n/route-messages";
import { useNotificationActions } from "./actions";
import { NOTIFICATIONS_NAMESPACES } from "./namespaces";

const ALL = "all";

type NotificationsScreenProps = NotificationsRouteData & {
  navigate: (options: { search: NotificationsRouteSearch }) => unknown;
  search: NotificationsRouteSearch;
};

const NotificationsList = ({
  search,
  userId,
}: {
  search: NotificationsRouteSearch;
  userId: number;
}) => {
  const t = useTranslations("core.notifications");
  const actions = useNotificationActions(userId);
  const query = useInfiniteQuery(
    notificationsInfiniteQueryOptions({
      filter: { category: search.category, unread: search.filter === "unread" },
      userId,
    }),
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <span className="sr-only">{t("loading")}</span>
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex items-start gap-3 p-2" key={index}>
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-lg border p-6 text-center"
        role="alert"
      >
        <p className="text-muted-foreground leading-relaxed">
          {t("load_error")}
        </p>
        <Button onClick={() => void query.refetch()} variant="outline">
          {t("retry")}
        </Button>
      </div>
    );
  }

  const items = query.data.pages.flatMap(page => page.items);
  if (items.length === 0) {
    return (
      <Empty className="rounded-lg border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellIcon />
          </EmptyMedia>
          <EmptyTitle>
            {search.filter === "unread"
              ? t("empty_unread_title")
              : t("empty_title")}
          </EmptyTitle>
          <EmptyDescription>{t("empty_desc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={t("list_label")} className="flex flex-col gap-1">
        {items.map(item => (
          <NotificationItem
            item={item}
            key={item.id}
            onArchive={item => void actions.archive(item)}
            onOpen={actions.open}
            onToggleRead={item => void actions.toggleRead(item)}
          />
        ))}
      </ul>
      {query.hasNextPage ? (
        <Button
          className="self-center"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          variant="outline"
        >
          {query.isFetchingNextPage ? t("loading") : t("load_more")}
        </Button>
      ) : null}
    </div>
  );
};

export const NotificationsRouteContent = ({
  description,
  navigate,
  search,
  title,
  userId,
}: NotificationsScreenProps) => (
  <RouteMessages namespaces={NOTIFICATIONS_NAMESPACES}>
    <NotificationsScreen
      description={description}
      navigate={navigate}
      search={search}
      title={title}
      userId={userId}
    />
  </RouteMessages>
);

const NotificationsScreen = ({
  description,
  navigate,
  search,
  title,
  userId,
}: NotificationsScreenProps) => {
  const t = useTranslations("core.notifications");
  const actions = useNotificationActions(userId);
  const state = useNotificationState(userId);
  const preferences = useQuery(notificationPreferencesQueryOptions({ userId }));
  const categories = [
    ...new Map(
      (preferences.data?.types ?? []).map(type => [
        type.category,
        type.categoryLabel,
      ]),
    ),
  ];

  return (
    <main className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle className="mb-0" desc={description} h1={title} />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            disabled={state?.unread === 0}
            onClick={() => void actions.markAllRead()}
            variant="outline"
          >
            <CheckCheckIcon />
            {t("mark_all_read")}
          </Button>
          <Button
            aria-label={t("settings")}
            nativeButton={false}
            render={<Link to={NOTIFICATION_SETTINGS_HREF} />}
            size="icon"
            title={t("settings")}
            variant="ghost"
          >
            <Settings2Icon />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          onValueChange={value =>
            navigate({
              search: {
                ...search,
                filter: value === "unread" ? "unread" : undefined,
              },
            })
          }
          value={search.filter ?? ALL}
        >
          <TabsList>
            <TabsTrigger value={ALL}>{t("filter_all")}</TabsTrigger>
            <TabsTrigger value="unread">
              {t("filter_unread")}
              {state && state.unread > 0 ? ` (${state.unread})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {categories.length > 1 ? (
          <Select
            items={[
              { label: t("all_categories"), value: ALL },
              ...categories.map(([value, label]) => ({ label, value })),
            ]}
            onValueChange={value =>
              navigate({
                search: {
                  ...search,
                  category:
                    typeof value === "string" && value !== ALL
                      ? value
                      : undefined,
                },
              })
            }
            value={search.category ?? ALL}
          >
            <SelectTrigger aria-label={t("category_label")} className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("all_categories")}</SelectItem>
              {categories.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <NotificationsList search={search} userId={userId} />
    </main>
  );
};
