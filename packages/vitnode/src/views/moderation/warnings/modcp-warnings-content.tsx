import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronRightIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

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
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";

import type { ModcpWarningsFilter } from "./warnings-api";

import { Person } from "../modcp/report-tone";
import { resolveReasonText } from "../report-reasons-query";
import { StaffWarningCard } from "./warning-list";
import {
  memberSearchQueryOptions,
  warningReasonsQueryOptions,
  warningsListQueryOptions,
} from "./warnings-api";

export const MODCP_WARNING_STATUSES = [
  "all",
  "active",
  "expired",
  "revoked",
] as const;

const StatusTabs = ({ status }: { status: ModcpWarningsFilter["status"] }) => {
  const t = useTranslations("core.moderation.warn");
  const { navigate, searchParams } = useDataTableUrl();

  return (
    <nav
      aria-label={t("list.status_label")}
      className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="bg-muted flex w-max gap-1 rounded-lg p-1">
        {MODCP_WARNING_STATUSES.map(value => {
          const next = withTableFilter(searchParams, {
            id: "status",
            values: value === "all" ? [] : [value],
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
                {value === "all" ? t("list.all") : t(`statuses.${value}`)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const ReasonFilter = () => {
  const t = useTranslations("core.moderation.warn");
  const locale = useLocale();
  // Moderators who can only view warnings cannot list reasons; no filter then.
  const reasons = useQuery(warningReasonsQueryOptions());
  if (!reasons.data || reasons.data.length === 0) return null;

  return (
    <FiltersDataTable
      filters={[
        {
          id: "reason",
          label: t("list.reason_filter"),
          options: reasons.data.map(reason => {
            const label = resolveReasonText(reason.title, locale);

            return { keywords: [label], label, value: String(reason.id) };
          }),
          single: { allLabel: t("list.all_reasons") },
        },
      ]}
    />
  );
};

/** Finds a member by name and links to their standing. */
export const MemberLookup = () => {
  const t = useTranslations("core.moderation.warn.lookup");
  const [search, setSearch] = React.useState("");
  const deferred = React.useDeferredValue(search);
  const results = useQuery(memberSearchQueryOptions(deferred));
  const inputId = React.useId();
  const statusId = React.useId();

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="bg-card ring-foreground/5 flex flex-col gap-3 rounded-xl p-4 shadow-xs ring-1 dark:shadow-none"
    >
      <h2
        className="text-foreground text-sm font-semibold"
        id={`${inputId}-title`}
      >
        {t("title")}
      </h2>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        />
        <label className="sr-only" htmlFor={inputId}>
          {t("label")}
        </label>
        <Input
          aria-describedby={statusId}
          className="ps-9"
          id={inputId}
          onChange={event => {
            setSearch(event.target.value);
          }}
          placeholder={t("placeholder")}
          type="search"
          value={search}
        />
      </div>
      <p aria-live="polite" className="sr-only" id={statusId} role="status">
        {results.data ? t("results", { count: results.data.length }) : ""}
      </p>
      {deferred.trim() && results.data ? (
        results.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul
            aria-busy={results.isFetching}
            className={cn(
              "divide-foreground/10 flex flex-col divide-y",
              results.isFetching && "opacity-60",
            )}
          >
            {results.data.map(person => (
              <li key={person.id}>
                <Link
                  className="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 outline-none focus-visible:ring-3"
                  to={`/modcp/members/${person.id}`}
                >
                  <Person person={person} size={28} />
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {results.isError ? (
        <p className="text-muted-foreground text-sm">{t("forbidden")}</p>
      ) : null}
    </section>
  );
};

const List = ({ filter }: { filter: ModcpWarningsFilter }) => {
  const t = useTranslations("core.moderation.warn");
  const { data } = useSuspenseQuery(warningsListQueryOptions(filter));
  const { isPending } = useDataTableUrl();
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      {data.items.length === 0 ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("list.empty_title")}</EmptyTitle>
            <EmptyDescription>{t("list.empty_desc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul
          aria-busy={isPending}
          className={cn("flex flex-col gap-3", isPending && "opacity-60")}
        >
          {data.items.map(item => (
            <li key={item.id}>
              <StaffWarningCard
                canRevoke={false}
                member={item.user}
                warning={item}
              />
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

/** The ModCP warning log: every warning the moderator may see, filtered. */
export const ModcpWarningsContent = ({
  description,
  filter,
  title,
}: {
  description: string;
  filter: ModcpWarningsFilter;
  title: string;
}) => (
  <div className="flex flex-col gap-6">
    <PageTitle desc={description} h1={title} />
    <MemberLookup />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <StatusTabs status={filter.status} />
      <ReasonFilter />
    </div>
    <List filter={filter} />
  </div>
);
