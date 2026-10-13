import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronRightIcon, ClipboardCheckIcon, FolderIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { FiltersDataTable } from "@/components/table/filters";
import { useDataTableUrl } from "@/components/table/navigation";
import { PaginationDataTable } from "@/components/table/pagination";
import { withTableFilter } from "@/components/table/url-state";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type {
  ModcpApprovalItem,
  ModcpApprovalsFilter,
  ModcpApprovalStatus,
} from "../modcp-query";

import {
  MODCP_APPROVAL_STATUSES,
  modcpApprovalFiltersQueryOptions,
  modcpApprovalsQueryOptions,
} from "../modcp-query";
import { ModcpPluginMessages } from "../plugin-messages";
import { PersonAvatar, PersonName } from "../report-tone";
import { approvalTypeLabelKey, useApprovalLabels } from "./approval-labels";
import { ApprovalKindChip, ApprovalStatusChip } from "./approval-tone";

const StatusTabs = ({ status }: { status: ModcpApprovalStatus }) => {
  const t = useTranslations("core.moderation.modcp.approvals");
  const { navigate, searchParams } = useDataTableUrl();

  return (
    <nav
      aria-label={t("status_label")}
      className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="bg-muted flex w-max gap-1 rounded-lg p-1">
        {MODCP_APPROVAL_STATUSES.map(value => {
          const next = withTableFilter(searchParams, {
            id: "status",
            values: value === "pending" ? [] : [value],
          });
          const isActive = value === status;

          return (
            <li key={value}>
              <a
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 flex h-9 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3",
                  isActive
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                href={next ? `?${next}` : "?"}
                onClick={event => {
                  event.preventDefault();
                  navigate(next);
                }}
              >
                {t(`statuses.${value}`)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const QueueFilters = () => {
  const t = useTranslations("core.moderation.modcp.approvals.filters");
  const labels = useApprovalLabels();
  const { data } = useSuspenseQuery(modcpApprovalFiltersQueryOptions());

  if (data.contentTypes.length < 2 && data.containers.length < 2) return null;

  return (
    <div className="border-foreground/10 flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <FiltersDataTable
        filters={[
          ...(data.contentTypes.length > 1
            ? [
                {
                  id: "type",
                  label: t("type"),
                  options: data.contentTypes.map(type => {
                    const label = labels.type({
                      contentTypeId: type.id,
                      pluginId: type.pluginId,
                    });

                    return { keywords: [label], label, value: type.id };
                  }),
                  single: { allLabel: t("all_types") },
                },
              ]
            : []),
          ...(data.containers.length > 1
            ? [
                {
                  id: "container",
                  label: t("container"),
                  options: data.containers.map(container => ({
                    keywords: [container.name],
                    label: `${"– ".repeat(container.depth)}${container.name}`,
                    value: String(container.id),
                  })),
                  single: { allLabel: t("all_containers") },
                },
              ]
            : []),
        ]}
      />
    </div>
  );
};

const QueueRow = ({ item }: { item: ModcpApprovalItem }) => {
  const t = useTranslations("core.moderation.modcp.approvals");
  const labels = useApprovalLabels();
  const typeLabel = labels.type(item);

  return (
    <Link
      className="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-start gap-3 px-4 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-inset"
      to={`/modcp/approvals/${item.id}`}
    >
      {item.author ? (
        <PersonAvatar className="mt-0.5" person={item.author} size={36} />
      ) : (
        <span
          aria-hidden
          className="bg-muted mt-0.5 size-9 shrink-0 rounded-full"
        />
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <ApprovalKindChip kind={item.kind} />
          <span className="text-muted-foreground text-xs font-medium">
            {typeLabel}
          </span>
          {item.status === "pending" ? null : (
            <ApprovalStatusChip status={item.status} />
          )}
        </span>

        <span
          className={cn(
            "line-clamp-2 leading-snug font-medium text-pretty",
            item.title ? "text-foreground" : "text-muted-foreground italic",
          )}
        >
          {item.title ?? t("untitled")}
        </span>

        <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          {item.author ? (
            <PersonName className="text-xs" person={item.author} />
          ) : (
            <span>{t("deleted_user")}</span>
          )}
          {item.container ? (
            <>
              <span aria-hidden>·</span>
              <span className="flex min-w-0 items-center gap-1">
                <FolderIcon aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">
                  {[...item.container.path, item.container.name].join(" / ")}
                </span>
              </span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <DateFormat date={item.createdAt} />
        </span>

        {item.status === "rejected" && item.reason ? (
          <span className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {t("reason_preview", { reason: item.reason })}
          </span>
        ) : null}
      </span>

      <ChevronRightIcon
        aria-hidden
        className="text-muted-foreground mt-1 size-4 shrink-0"
      />
    </Link>
  );
};

const Queue = ({ filter }: { filter: ModcpApprovalsFilter }) => {
  const t = useTranslations("core.moderation.modcp.approvals");
  const { data } = useSuspenseQuery(modcpApprovalsQueryOptions(filter));
  const { isPending } = useDataTableUrl();
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const isFiltered =
    filter.contentTypeId !== undefined || filter.containerId !== undefined;

  return (
    <>
      {data.items.length === 0 ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardCheckIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>
              {t(
                filter.status === "pending" && !isFiltered
                  ? "empty.pending_title"
                  : "empty.title",
              )}
            </EmptyTitle>
            <EmptyDescription>
              {t(
                filter.status === "pending" && !isFiltered
                  ? "empty.pending_desc"
                  : "empty.desc",
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul
          aria-busy={isPending}
          aria-label={t(`statuses.${filter.status}`)}
          className={cn(
            "divide-foreground/10 divide-y",
            isPending && "opacity-60",
          )}
        >
          {data.items.map(item => (
            <li key={item.id}>
              <QueueRow item={item} />
            </li>
          ))}
        </ul>
      )}

      <PaginationDataTable
        pageInfo={{
          count: data.items.length,
          currentPage: data.page,
          endCursor: null,
          hasNextPage: data.page < totalPages,
          hasPreviousPage: data.page > 1,
          pageSize: data.pageSize,
          startCursor: null,
          totalCount: data.total,
          totalPages,
        }}
      />
    </>
  );
};

export const ModcpApprovalsContent = ({
  description,
  filter,
  title,
}: {
  description: string;
  filter: ModcpApprovalsFilter;
  title: string;
}) => {
  const { data } = useSuspenseQuery(modcpApprovalFiltersQueryOptions());

  return (
    <ModcpPluginMessages
      labels={data.contentTypes.map(type =>
        approvalTypeLabelKey({
          contentTypeId: type.id,
          pluginId: type.pluginId,
        }),
      )}
    >
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            {title}
          </h1>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {description}
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <StatusTabs status={filter.status} />

          <section
            aria-label={title}
            className="bg-card ring-foreground/10 overflow-hidden rounded-xl shadow-xs ring-1 dark:shadow-none"
          >
            <QueueFilters />
            <Queue filter={filter} />
          </section>
        </div>
      </div>
    </ModcpPluginMessages>
  );
};
