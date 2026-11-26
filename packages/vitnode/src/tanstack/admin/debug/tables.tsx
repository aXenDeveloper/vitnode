import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { CronHealth } from "@/views/admin/views/core/advanced/cron/cron-query";
import type { DebugAreaId } from "@/views/admin/views/core/debug/health/health";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import {
  AdminStaffPermissionGate,
  useAdminStaffPermission,
} from "@/components/staff-permission/provider";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { Frame, FramePanel } from "@/components/ui/frame";
import { cronHealthQueryOptions } from "@/views/admin/views/core/advanced/cron/cron-query";
import { CronSchedulerStatus } from "@/views/admin/views/core/advanced/cron/cron-scheduler-status";
import { CronTableContent } from "@/views/admin/views/core/advanced/cron/cron-table-content";
import { QueueTableContent } from "@/views/admin/views/core/advanced/queue/queue-table-content";
import { SearchHeaderActions } from "@/views/admin/views/core/advanced/search/search-header-actions";
import { SearchIndexContent } from "@/views/admin/views/core/advanced/search/search-index-content";
import { AiHistoryTableContent } from "@/views/admin/views/core/ai/history/history-table-content";
import { CleanQueueAction } from "@/views/admin/views/core/debug/actions/clean-queue/clean-queue";
import { debugHealth } from "@/views/admin/views/core/debug/health/health";
import {
  IssueRow,
  SectionHeader,
} from "@/views/admin/views/core/debug/sections/frame-row";
import { SystemLogsContent } from "@/views/admin/views/core/debug/system-logs/system-logs-content";
import { ToneBadge } from "@/views/admin/views/core/debug/tone";
import { isAdminMutationError } from "@/views/admin/views/core/shared/admin-mutation";
import {
  ADMIN_DEBUG_PERMISSIONS,
  ADMIN_SEARCH_PERMISSIONS,
  ADMIN_USER_PERMISSIONS,
} from "@/views/admin/views/core/shared/admin-permissions";
import { AccountDeletionsAttention } from "@/views/admin/views/core/users/deletions/deletions-attention";
import {
  cancelAdminAccountDeletion,
  retryAccountDeletion,
} from "@/views/admin/views/core/users/deletions/deletions-mutations";
import {
  ACCOUNT_DELETIONS_QUERY_ROOT,
  accountDeletionsQueryOptions,
  accountDeletionsSummaryQueryOptions,
} from "@/views/admin/views/core/users/deletions/deletions-query";
import { AccountDeletionsTable } from "@/views/admin/views/core/users/deletions/deletions-table";

import type { AiHistoryRouteSearch } from "../ai/route-search";
import type { CronRouteSearch } from "../cron/route-search";
import type { QueueRouteSearch } from "../queue/route-search";
import type { SearchIndexRouteSearch } from "../search-index/route-search";
import type { AdminTableNavigate } from "../table-search";
import type {
  DebugDeletionsRouteSearch,
  DebugLogsRouteSearch,
} from "./route-search";

import {
  adminAiActionsQuery,
  adminAiHistoryQuery,
  adminAiModelsQuery,
  adminAiRunQuery,
} from "../ai/query";
import {
  aiHistoryRouteParams,
  aiHistorySearchFrom,
  aiHistorySearchParams,
  normalizeAiHistoryRouteSearch,
} from "../ai/route-search";
import { cronQuery, useCronRunCallback } from "../cron/query";
import { cronSearchFrom, cronSearchParams } from "../cron/route-search";
import { useAdminIdentity } from "../identity";
import { queueQuery } from "../queue/query";
import {
  queueRouteParams,
  queueSearchFrom,
  queueSearchParams,
} from "../queue/route-search";
import { searchIndexQuery, useSearchIndexActions } from "../search-index/query";
import {
  searchIndexSearchFrom,
  searchIndexSearchParams,
} from "../search-index/route-search";
import { invalidateAdminUsers } from "../users/query";
import { debugLogsQuery, useCleanQueue, useDebugSources } from "./query";
import {
  debugCronParams,
  debugDeletionsRouteParams,
  debugDeletionsSearchFrom,
  debugDeletionsSearchParams,
  debugLogsRouteParams,
  debugLogsSearchFrom,
  debugLogsSearchParams,
} from "./route-search";

const useTableNavigation = <TSearch,>({
  from,
  navigate,
  searchParams,
}: {
  from: (nextSearch: string) => TSearch;
  navigate: AdminTableNavigate<TSearch>;
  searchParams: URLSearchParams;
}): DataTableNavigation =>
  React.useMemo<DataTableNavigation>(
    () => ({
      navigate: async nextSearch => {
        await navigate({
          resetScroll: false,
          search: from(nextSearch),
        });
      },
      searchParams,
    }),
    [from, navigate, searchParams],
  );

const AreaHeader = ({
  action,
  tab,
}: {
  action?: React.ReactNode;
  tab: DebugAreaId;
}) => {
  const t = useTranslations("admin.debug");
  const tHealth = useTranslations("admin.debug.health");
  const area = debugHealth(useDebugSources()).areas.find(
    entry => entry.id === tab,
  );
  if (!area) return null;

  return (
    <SectionHeader
      action={action}
      badge={area.tone === "off" ? null : <ToneBadge tone={area.tone} />}
      description={tHealth(area.subtitle.key, area.subtitle.values)}
      title={t(`nav.${area.id}`)}
    />
  );
};

const SCHEDULER_CARD_CHECKS = new Set(["cron-overdue", "cron-stopped"]);

const CronIssues = ({ health }: { health: CronHealth }) => {
  const issues = debugHealth(useDebugSources())
    .issues.filter(issue => issue.area === "cron")
    .filter(
      issue =>
        !SCHEDULER_CARD_CHECKS.has(issue.id) &&
        !(issue.id === "cron-secret" && health.secretRejected),
    );
  if (issues.length === 0) return null;

  return (
    <Frame>
      <FramePanel>
        {issues.map(issue => (
          <IssueRow issue={issue} key={issue.id} />
        ))}
      </FramePanel>
    </Frame>
  );
};

const DiagnosticHeader = ({
  action,
  tab,
}: {
  action?: React.ReactNode;
  tab: "ai" | "deletions" | "logs" | "queue";
}) => {
  const t = useTranslations("admin.debug");

  return (
    <SectionHeader
      action={action}
      description={t(`diagnostics.${tab}`)}
      title={t(`nav.${tab}`)}
    />
  );
};

export const DebugCronTab = ({
  navigate,
  search,
}: {
  navigate: AdminTableNavigate<CronRouteSearch>;
  search: CronRouteSearch;
}) => {
  const { data } = useSuspenseQuery(
    cronQuery({ params: debugCronParams(search) }),
  );
  const { data: health } = useSuspenseQuery(cronHealthQueryOptions());
  const onRun = useCronRunCallback();
  const searchParams = React.useMemo(() => cronSearchParams(search), [search]);
  const navigation = useTableNavigation({
    from: cronSearchFrom,
    navigate,
    searchParams,
  });

  return (
    <div className="flex flex-col gap-6">
      <AreaHeader tab="cron" />
      <CronIssues health={health} />
      <CronSchedulerStatus health={health} />
      <DataTableNavigationProvider value={navigation}>
        <CronTableContent data={data} onRun={onRun} />
      </DataTableNavigationProvider>
    </div>
  );
};

export const DebugSearchTab = ({
  navigate,
  search,
}: {
  navigate: AdminTableNavigate<SearchIndexRouteSearch>;
  search: SearchIndexRouteSearch;
}) => {
  const { data } = useSuspenseQuery(searchIndexQuery());
  const actions = useSearchIndexActions();
  const searchParams = React.useMemo(
    () => searchIndexSearchParams(search),
    [search],
  );
  const navigation = useTableNavigation({
    from: searchIndexSearchFrom,
    navigate,
    searchParams,
  });

  return (
    <div className="flex flex-col gap-6">
      <AreaHeader
        action={
          <AdminStaffPermissionGate {...ADMIN_SEARCH_PERMISSIONS.manage}>
            <SearchHeaderActions onRebuild={actions.rebuild} />
          </AdminStaffPermissionGate>
        }
        tab="search"
      />
      <DataTableNavigationProvider value={navigation}>
        <SearchIndexContent
          actions={actions}
          data={data}
          search={search.search}
        />
      </DataTableNavigationProvider>
    </div>
  );
};

export const DebugLogsTab = ({
  navigate,
  search,
}: {
  navigate: AdminTableNavigate<DebugLogsRouteSearch>;
  search: DebugLogsRouteSearch;
}) => {
  const { data } = useSuspenseQuery(
    debugLogsQuery({ params: debugLogsRouteParams(search) }),
  );
  const searchParams = React.useMemo(
    () => debugLogsSearchParams(search),
    [search],
  );
  const navigation = useTableNavigation({
    from: debugLogsSearchFrom,
    navigate,
    searchParams,
  });

  return (
    <div className="flex flex-col gap-6">
      <DiagnosticHeader tab="logs" />
      <DataTableNavigationProvider value={navigation}>
        <SystemLogsContent data={data} />
      </DataTableNavigationProvider>
    </div>
  );
};

export const DebugQueueTab = ({
  navigate,
  search,
}: {
  navigate: AdminTableNavigate<QueueRouteSearch>;
  search: QueueRouteSearch;
}) => {
  const { data } = useSuspenseQuery(
    queueQuery({ params: queueRouteParams(search) }),
  );
  const searchParams = React.useMemo(() => queueSearchParams(search), [search]);
  const navigation = useTableNavigation({
    from: queueSearchFrom,
    navigate,
    searchParams,
  });
  const queueCounts = useDebugSources().queue?.counts;
  const onClean = useCleanQueue();

  return (
    <div className="flex flex-col gap-6">
      <DiagnosticHeader
        action={
          <AdminStaffPermissionGate {...ADMIN_DEBUG_PERMISSIONS.cleanQueue}>
            <CleanQueueAction counts={queueCounts} onClean={onClean} />
          </AdminStaffPermissionGate>
        }
        tab="queue"
      />
      <DataTableNavigationProvider value={navigation}>
        <QueueTableContent data={data} />
      </DataTableNavigationProvider>
    </div>
  );
};

export const DebugDeletionsTab = ({
  navigate,
  search,
}: {
  navigate: AdminTableNavigate<DebugDeletionsRouteSearch>;
  search: DebugDeletionsRouteSearch;
}) => {
  const t = useTranslations("admin.user.deletions");
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();
  const canDelete = useAdminStaffPermission(ADMIN_USER_PERMISSIONS.delete);
  const { data } = useSuspenseQuery(
    accountDeletionsQueryOptions({ params: debugDeletionsRouteParams(search) }),
  );
  const { data: summary } = useSuspenseQuery(
    accountDeletionsSummaryQueryOptions(),
  );
  const searchParams = React.useMemo(
    () => debugDeletionsSearchParams(search),
    [search],
  );
  const navigation = useTableNavigation({
    from: debugDeletionsSearchFrom,
    navigate,
    searchParams,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ACCOUNT_DELETIONS_QUERY_ROOT }),
      invalidateAdminUsers(queryClient, adminUserId),
    ]);
  };
  const onCancel = async (deletionId: number) => {
    const result = await cancelAdminAccountDeletion(deletionId);
    if (!isAdminMutationError(result)) await refresh();

    return result;
  };
  const onErase = async (deletionId: number) => {
    const result = await retryAccountDeletion(deletionId);
    await refresh();

    return result;
  };

  return (
    <div className="flex flex-col gap-6">
      <AreaHeader tab="deletions" />

      <AccountDeletionsAttention
        canDelete={canDelete}
        onCancel={onCancel}
        onErase={onErase}
        summary={summary}
      />

      <section
        aria-labelledby="deletions-all-title"
        className="flex flex-col gap-3"
      >
        <h3 className="text-base font-semibold" id="deletions-all-title">
          {t("all")}
        </h3>
        <DataTableNavigationProvider value={navigation}>
          <AccountDeletionsTable
            canDelete={canDelete}
            data={data}
            onCancel={onCancel}
            onErase={onErase}
          />
        </DataTableNavigationProvider>
      </section>
    </div>
  );
};

export const DebugAiTab = ({
  adminUserId,
  navigate,
  search,
}: {
  adminUserId: AdminIdentity;
  navigate: AdminTableNavigate<AiHistoryRouteSearch>;
  search: AiHistoryRouteSearch;
}) => {
  const { data } = useSuspenseQuery(
    adminAiHistoryQuery({
      adminUserId,
      params: aiHistoryRouteParams(search),
    }),
  );
  const { data: actionsData } = useSuspenseQuery(
    adminAiActionsQuery({ adminUserId }),
  );
  const { data: modelsData } = useSuspenseQuery(
    adminAiModelsQuery({ adminUserId }),
  );
  const searchParams = React.useMemo(
    () => aiHistorySearchParams(search),
    [search],
  );
  const navigation = useTableNavigation({
    from: aiHistorySearchFrom,
    navigate,
    searchParams,
  });
  const { action, actorType, first, modelId, order, status } =
    normalizeAiHistoryRouteSearch(search);

  return (
    <div className="flex flex-col gap-6">
      <DiagnosticHeader tab="ai" />
      <DataTableNavigationProvider value={navigation}>
        <AiHistoryTableContent
          actions={actionsData.actions}
          data={data}
          filters={{ action, actorType, modelId, status }}
          models={modelsData.models}
          onFilterChange={next => {
            void navigate({
              resetScroll: false,
              search: normalizeAiHistoryRouteSearch({ ...next, first, order }),
            });
          }}
          runQuery={id => adminAiRunQuery({ adminUserId, id })}
        />
      </DataTableNavigationProvider>
    </div>
  );
};
