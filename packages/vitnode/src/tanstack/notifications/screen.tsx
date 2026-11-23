import type { QueryClient } from "@tanstack/react-query";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ArchiveIcon,
  BellIcon,
  BellOffIcon,
  CheckCheckIcon,
  MailIcon,
  MailOpenIcon,
  RotateCwIcon,
  Settings2Icon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ColumnDef } from "@/components/table/data-table-content";
import type { FilterDataTable } from "@/components/table/filters";
import type { DataTableNavigation } from "@/components/table/navigation";
import type { NotificationItemView } from "@/views/notifications/notifications-query";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";
import { DataTableSkeleton } from "@/components/table/data-table-content";
import { FiltersDataTable } from "@/components/table/filters";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageTitle } from "@/components/ui/page-title";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { MarkAllReadConfirm } from "@/views/notifications/mark-all-read-confirm";
import { NotificationAvatar } from "@/views/notifications/notification-avatar";
import { isModifiedClick } from "@/views/notifications/notification-item";
import { useNotificationState } from "@/views/notifications/notification-state-store";
import { NOTIFICATION_SETTINGS_HREF } from "@/views/notifications/notifications-bell-content";
import {
  notificationPreferencesQueryOptions,
  notificationsListRoot,
  notificationsTableQueryOptions,
} from "@/views/notifications/notifications-query";

import type { NotificationsRouteData } from "./route";
import type {
  NotificationsRouteSearch,
  UncheckedNotificationsSearch,
} from "./route-search";

import { RouteMessages } from "../i18n/route-messages";
import { useNotificationActions } from "./actions";
import { NOTIFICATIONS_NAMESPACES } from "./namespaces";
import {
  notificationsRouteParams,
  notificationsSearchFrom,
  notificationsSearchParams,
} from "./route-search";

type NotificationsScreenProps = NotificationsRouteData & {
  navigate: (options: {
    resetScroll: boolean;
    search: NotificationsRouteSearch;
  }) => unknown;
  search: UncheckedNotificationsSearch;
};

type NotificationActions = ReturnType<typeof useNotificationActions>;

const refreshNotificationsTable = async (
  queryClient: QueryClient,
  userId: number,
) =>
  await queryClient.invalidateQueries({
    queryKey: [...notificationsListRoot(userId), "table"],
  });

const titleClassName =
  "focus-visible:ring-ring line-clamp-2 rounded-sm text-start text-sm leading-relaxed text-pretty underline-offset-4 outline-none hover:underline focus-visible:ring-2";

const NotificationTitle = ({
  actions,
  item,
}: {
  actions: NotificationActions;
  item: NotificationItemView;
}) => {
  const className = cn(
    titleClassName,
    item.unread ? "text-foreground font-medium" : "text-muted-foreground",
  );

  if (item.target === null) {
    return (
      <button
        className={className}
        onClick={() => actions.open(item, { newTab: false })}
        type="button"
      >
        {item.title}
      </button>
    );
  }

  return (
    <a
      className={className}
      href={item.target}
      onClick={event => {
        const newTab = isModifiedClick(event);
        if (!newTab) event.preventDefault();
        actions.open(item, { newTab });
      }}
    >
      {item.title}
    </a>
  );
};

const RowActions = ({
  item,
  onArchive,
  onToggleRead,
}: {
  item: NotificationItemView;
  onArchive: (item: NotificationItemView) => void;
  onToggleRead: (item: NotificationItemView) => void;
}) => {
  const t = useTranslations("core.global.notifications");
  const toggleLabel = item.unread ? t("mark_read") : t("mark_unread");

  return (
    <div className="flex items-center justify-end gap-1">
      <TooltipWithContent text={toggleLabel}>
        <Button
          aria-label={toggleLabel}
          onClick={() => onToggleRead(item)}
          size="icon-sm"
          variant="ghost"
        >
          {item.unread ? (
            <MailOpenIcon aria-hidden="true" />
          ) : (
            <MailIcon aria-hidden="true" />
          )}
        </Button>
      </TooltipWithContent>
      <TooltipWithContent text={t("archive")}>
        <Button
          aria-label={t("archive")}
          onClick={() => onArchive(item)}
          size="icon-sm"
          variant="ghost"
        >
          <ArchiveIcon aria-hidden="true" />
        </Button>
      </TooltipWithContent>
    </div>
  );
};

const NotificationsTable = ({
  navigation,
  search,
  userId,
}: {
  navigation: DataTableNavigation;
  search: UncheckedNotificationsSearch;
  userId: number;
}) => {
  const t = useTranslations("core.notifications");
  const tGlobal = useTranslations("core.global.notifications");
  const queryClient = useQueryClient();
  const actions = useNotificationActions(userId);
  const state = useNotificationState(userId);
  const params = notificationsRouteParams(search);
  const query = useQuery(notificationsTableQueryOptions({ params, userId }));
  const preferences = useQuery(notificationPreferencesQueryOptions({ userId }));

  const categoryLabels = new Map(
    (preferences.data?.types ?? []).map(type => [
      type.category,
      type.categoryLabel,
    ]),
  );

  const archive = async (item: NotificationItemView) => {
    await actions.archive(item);
    await refreshNotificationsTable(queryClient, userId);
  };

  if (query.isPending) {
    return <DataTableSkeleton columns={5} header rows={8} toolbar />;
  }

  if (query.isError && !query.data) {
    return (
      <Empty className="rounded-lg border" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellOffIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={query.isFetching}
            onClick={() => void query.refetch()}
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const columns: ColumnDef<NotificationItemView>[] = [
    {
      id: "status",
      header: <span className="sr-only">{t("column_status")}</span>,
      className: "w-2",
      cell: ({ row }) =>
        row.unread ? (
          <span className="flex items-center">
            <span
              aria-hidden="true"
              className="bg-primary size-2 rounded-full"
            />
            <span className="sr-only">{tGlobal("unread")}</span>
          </span>
        ) : (
          <span className="sr-only">{t("status_read")}</span>
        ),
    },
    {
      accessorKey: "title",
      header: t("column_notification"),
      className: "min-w-72 whitespace-normal",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-start gap-3">
          <NotificationAvatar item={row} surface="background" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <NotificationTitle actions={actions} item={row} />
            {row.body ? (
              <p className="text-muted-foreground line-clamp-1 text-sm leading-relaxed">
                {row.body}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: t("column_category"),
      className: "w-32",
      cell: ({ row }) => (
        <Badge variant="outline">
          {categoryLabels.get(row.category) ?? row.category}
        </Badge>
      ),
    },
    {
      accessorKey: "lastActivityAt",
      header: t("column_received"),
      align: "right",
      className: "w-36 whitespace-nowrap",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm tabular-nums">
          <DateFormat date={row.lastActivityAt} />
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("column_actions")}</span>,
      align: "right",
      className: "w-20",
      cell: ({ row }) => (
        <RowActions
          item={row}
          onArchive={item => void archive(item)}
          onToggleRead={item => void actions.toggleRead(item)}
        />
      ),
    },
  ];

  const filters: FilterDataTable[] = [
    {
      id: "status",
      label: t("filter_status"),
      options: [
        { label: t("filter_unread"), value: "unread" },
        { label: t("status_read"), value: "read" },
      ],
      single: { allLabel: t("filter_status_all") },
    },
    ...(categoryLabels.size > 1
      ? [
          {
            id: "category",
            label: t("filter_category"),
            options: [...categoryLabels].map(([value, label]) => ({
              label,
              value,
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {query.isError ? (
        <Alert variant="warning">
          <BellOffIcon aria-hidden="true" />
          <AlertTitle>{t("load_error.title")}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {t("load_error.desc")}
            <Button
              isLoading={query.isFetching}
              onClick={() => void query.refetch()}
              size="sm"
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <DataTableNavigationProvider value={navigation}>
        <ContentDataTable
          aria-busy={query.isFetching}
          aria-label={t("title")}
          columns={columns}
          customNoResults={{
            description: t("empty_desc"),
            icon: <BellIcon aria-hidden="true" />,
            title:
              params.status === "unread"
                ? t("empty_unread_title")
                : t("empty_title"),
          }}
          edges={query.data.edges}
          header={
            <>
              <p className="text-muted-foreground text-sm tabular-nums">
                {t.rich("summary", {
                  b: chunks => (
                    <span className="text-foreground font-medium">
                      {chunks}
                    </span>
                  ),
                  total: query.data.pageInfo.totalCount,
                  unread: state?.unread ?? 0,
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <FiltersDataTable filters={filters} />
              </div>
            </>
          }
          id="notifications"
          order={{
            columns: ["lastActivityAt", "category"],
            defaultOrder: { column: "lastActivityAt", order: "desc" },
          }}
          pageInfo={query.data.pageInfo}
        />
      </DataTableNavigationProvider>
    </div>
  );
};

const MarkAllReadAction = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.notifications");
  const queryClient = useQueryClient();
  const actions = useNotificationActions(userId);
  const unread = useNotificationState(userId)?.unread ?? 0;

  return (
    <MarkAllReadConfirm
      onConfirm={async () => {
        await actions.markAllRead();
        await refreshNotificationsTable(queryClient, userId);
      }}
      unread={unread}
    >
      <Button disabled={unread === 0}>
        <CheckCheckIcon aria-hidden="true" />
        {t("mark_all_read")}
      </Button>
    </MarkAllReadConfirm>
  );
};

export const NotificationsRouteContent = (props: NotificationsScreenProps) => (
  <RouteMessages namespaces={NOTIFICATIONS_NAMESPACES}>
    <NotificationsScreen {...props} />
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

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: notificationsSearchFrom(nextSearch),
        });
      },
      searchParams: notificationsSearchParams(search),
    }),
    [navigate, search],
  );

  return (
    <main className="container mx-auto flex max-w-6xl flex-col gap-6 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageTitle className="mb-0" desc={description} h1={title} />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            nativeButton={false}
            render={<Link to={NOTIFICATION_SETTINGS_HREF} />}
            variant="ghost"
          >
            <Settings2Icon aria-hidden="true" />
            {t("settings_button")}
          </Button>
          <MarkAllReadAction userId={userId} />
        </div>
      </div>

      <NotificationsTable
        navigation={navigation}
        search={search}
        userId={userId}
      />
    </main>
  );
};
