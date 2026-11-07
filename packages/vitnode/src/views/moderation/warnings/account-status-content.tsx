import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  MessageSquareWarningIcon,
  RotateCwIcon,
  ShieldCheckIcon,
  ShieldIcon,
} from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "use-intl";

import type { ColumnDef } from "@/components/table/data-table-content";
import type {
  ProfileStanding,
  StandingSuspension,
  StandingTarget,
  StandingWarning,
} from "@/views/profile/warnings/standing";

import { ContentDataTable } from "@/components/table/content";
import { DataTableSkeleton } from "@/components/table/data-table-content";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { PageTitle } from "@/components/ui/page-title";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { standingFromAccountStatus } from "@/views/profile/warnings/standing";
import {
  reasonTextOf,
  SuspensionLength,
  SuspensionNode,
  SuspensionTitle,
  WarningNode,
} from "@/views/profile/warnings/standing-parts";

import type {
  AccountStatus,
  AccountStatusHistory,
  AccountStatusHistoryParams,
} from "./warnings-api";

import { SuspensionStatusBadge } from "./suspension-status-badge";
import { WarningStatusBadge } from "./warning-format";
import {
  accountStatusHistoryQueryOptions,
  accountStatusQueryOptions,
} from "./warnings-api";

const StandingSheetContent = React.lazy(
  async () => await import("@/views/profile/warnings/standing-sheet-content"),
);

type HistoryRow =
  | {
      at: Date;
      id: string;
      kind: "suspension";
      points: number;
      suspension: StandingSuspension;
    }
  | {
      at: Date;
      id: string;
      kind: "warning";
      points: number;
      warning: StandingWarning;
    };

const rowsOf = (items: AccountStatusHistory["items"]): HistoryRow[] => {
  const page = standingFromAccountStatus({
    activePoints: 0,
    sanctions: items.flatMap(item =>
      item.kind === "suspension" ? [item.suspension] : [],
    ),
    suspension: null,
    warnings: items.flatMap(item =>
      item.kind === "warning" ? [item.warning] : [],
    ),
  });

  return items.flatMap((item): HistoryRow[] => {
    if (item.kind === "warning") {
      const warning = page.warnings.find(w => w.id === item.warning.id);

      return warning
        ? [
            {
              at: warning.issuedAt,
              id: `w-${warning.id}`,
              kind: "warning",
              points: warning.points,
              warning,
            },
          ]
        : [];
    }
    const suspension = page.suspensions.find(s => s.id === item.suspension.id);

    return suspension
      ? [
          {
            at: suspension.startsAt,
            id: `s-${suspension.id}`,
            kind: "suspension",
            points: 0,
            suspension,
          },
        ]
      : [];
  });
};

const nextExpiryOf = (standing: ProfileStanding) =>
  standing.warnings
    .flatMap(w =>
      w.status === "active" && w.points > 0 && w.expiresAt ? [w.expiresAt] : [],
    )
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

const Hero = ({ standing }: { standing: ProfileStanding }) => {
  const t = useTranslations("core.moderation.account_status");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const counting = standing.warnings.filter(
    w => w.status === "active" && w.points > 0,
  ).length;
  const hasHistory =
    standing.warnings.length > 0 || standing.suspensions.length > 0;
  const withPoints = standing.activePoints > 0;
  const next = nextExpiryOf(standing);
  const Icon = withPoints ? ShieldIcon : ShieldCheckIcon;

  return (
    <section
      aria-label={t("summary")}
      className="bg-card ring-foreground/10 flex flex-col gap-5 rounded-xl p-5 shadow-xs ring-1 sm:flex-row sm:items-center"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-full",
          withPoints ? "bg-warn/15" : "bg-success/10",
        )}
      >
        <Icon
          className={cn(
            "size-7",
            withPoints
              ? FEEDBACK_TONE_TEXT.warning
              : FEEDBACK_TONE_TEXT.success,
          )}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold text-balance">
          {t("good_title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {withPoints ? (
            <>
              {t.rich("hero_points", {
                b: chunks => (
                  <span className="text-foreground font-medium tabular-nums">
                    {chunks}
                  </span>
                ),
                points: standing.activePoints,
                warnings: counting,
              })}{" "}
              {next
                ? t("hero_next", {
                    date: format.dateTime(next, { dateStyle: "long" }),
                    relative: format.relativeTime(next, now),
                  })
                : t("hero_never")}
            </>
          ) : hasHistory ? (
            t("hero_cleared")
          ) : (
            t("hero_clean")
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-start sm:items-end">
        <span
          className={cn(
            "text-4xl font-semibold tabular-nums",
            withPoints ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {standing.activePoints}
        </span>
        <span className="text-muted-foreground text-xs">
          {t("points_title")}
        </span>
      </div>
    </section>
  );
};

const ItemCell = ({ row }: { row: HistoryRow }) => {
  const t = useTranslations("core.moderation.account_status.history");
  const tWarn = useTranslations("core.moderation.warn");
  const locale = useLocale();

  return (
    <span className="flex min-w-0 items-center gap-3">
      {row.kind === "warning" ? (
        <WarningNode size="sm" warning={row.warning} />
      ) : (
        <SuspensionNode active={row.suspension.active} size="sm" />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "truncate text-sm font-medium",
            row.kind === "warning" && row.warning.status === "revoked"
              ? "text-muted-foreground line-through"
              : "text-foreground",
          )}
        >
          {row.kind === "warning" ? (
            reasonTextOf(row.warning, locale, tWarn("custom_reason"))
          ) : (
            <SuspensionTitle suspension={row.suspension} />
          )}
        </span>
        <span className="text-muted-foreground text-xs">
          {row.kind === "warning" ? (
            t("warning")
          ) : (
            <SuspensionLength suspension={row.suspension} />
          )}
        </span>
      </span>
    </span>
  );
};

const LoadError = ({
  isFetching,
  onRetry,
}: {
  isFetching: boolean;
  onRetry: () => void;
}) => {
  const t = useTranslations("core.moderation.account_status");

  return (
    <Empty className="border" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquareWarningIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("load_error.title")}</EmptyTitle>
        <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button isLoading={isFetching} onClick={onRetry} variant="outline">
          <RotateCwIcon aria-hidden="true" />
          {t("retry")}
        </Button>
      </EmptyContent>
    </Empty>
  );
};

const HistoryTable = ({
  onOpen,
  params,
}: {
  onOpen: (target: NonNullable<StandingTarget>) => void;
  params: AccountStatusHistoryParams;
}) => {
  const t = useTranslations("core.moderation.account_status.history");
  const format = useFormatter();
  const query = useQuery(accountStatusHistoryQueryOptions(params));

  if (query.isPending) return <DataTableSkeleton columns={4} toolbar />;
  if (!query.data) {
    return (
      <LoadError
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { page, pageSize, total } = query.data;
  const edges = rowsOf(query.data.items);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columns: ColumnDef<HistoryRow>[] = [
    {
      cell: ({ row }) => <ItemCell row={row} />,
      header: t("item"),
      id: "item",
    },
    {
      accessorKey: "at",
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(row.at, { dateStyle: "medium" })}
        </span>
      ),
      className: "w-36",
      header: t("date"),
    },
    {
      accessorKey: "points",
      align: "right",
      cell: ({ row }) =>
        row.kind === "warning" ? (
          <span className="tabular-nums">{row.points}</span>
        ) : (
          <span aria-hidden="true" className="text-muted-foreground">
            -
          </span>
        ),
      className: "w-20",
      header: t("points"),
    },
    {
      cell: ({ row }) =>
        row.kind === "warning" ? (
          <WarningStatusBadge status={row.warning.status} />
        ) : (
          <SuspensionStatusBadge suspension={row.suspension} />
        ),
      className: "w-28",
      header: t("status"),
      id: "status",
    },
  ];

  return (
    <div
      aria-busy={query.isFetching}
      className={cn(
        "motion-safe:transition-opacity",
        query.isFetching ? "opacity-60" : null,
      )}
    >
      <ContentDataTable<HistoryRow>
        aria-label={t("label")}
        columns={columns}
        customNoResults={{
          description: t("no_results.desc"),
          title: t("no_results.title"),
        }}
        edges={edges}
        filters={[
          {
            id: "type",
            label: t("type"),
            options: [
              { label: t("type_warnings"), value: "warning" },
              { label: t("type_suspensions"), value: "suspension" },
            ],
          },
          {
            id: "status",
            label: t("status"),
            options: [
              { label: t("status_active"), value: "active" },
              { label: t("status_expired"), value: "expired" },
              { label: t("status_revoked"), value: "revoked" },
              { label: t("status_lifted"), value: "lifted" },
              { label: t("status_ended"), value: "ended" },
            ],
          },
        ]}
        id="account-status-history"
        order={{
          columns: ["at", "points"],
          defaultOrder: { column: "at", order: "desc" },
        }}
        pageInfo={{
          count: edges.length,
          currentPage: page,
          endCursor: null,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
          pageSize,
          startCursor: null,
          totalCount: total,
          totalPages,
        }}
        rowOpens={row => {
          onOpen(
            row.kind === "warning"
              ? { id: row.warning.id, kind: "warning" }
              : { id: row.suspension.id, kind: "suspension" },
          );
        }}
        search
        searchPlaceholder={t("search")}
      />
    </div>
  );
};

const DetailSheet = ({
  onTarget,
  standing,
  target,
}: {
  onTarget: (target: StandingTarget) => void;
  standing: ProfileStanding;
  target: StandingTarget;
}) => {
  const [shown, setShown] = React.useState(target);
  if (target && target !== shown) setShown(target);

  return (
    <Sheet
      onOpenChange={open => {
        if (!open) onTarget(null);
      }}
      open={target !== null}
    >
      <SheetContent className="gap-0 sm:max-w-md">
        {shown ? (
          <React.Suspense
            fallback={
              <div aria-busy="true" className="flex flex-col gap-4 p-6">
                <Skeleton className="size-12 rounded-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-24 w-full" />
              </div>
            }
          >
            <StandingSheetContent
              onConfirm={() => {}}
              onSelect={onTarget}
              standing={standing}
              target={shown}
            />
          </React.Suspense>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

const Heading = () => {
  const t = useTranslations("core.moderation.account_status");
  const tSettings = useTranslations("core.auth.settings");

  return (
    <PageTitle
      className="mb-0"
      desc={t("desc")}
      h1={t("title")}
      subtitle={tSettings("title")}
    />
  );
};

const hasHistoryOf = (status: AccountStatus) =>
  status.warnings.length > 0 || status.sanctions.length > 0;

export const AccountStatusContent = ({
  params,
}: {
  params: AccountStatusHistoryParams;
}) => {
  const t = useTranslations("core.moderation.account_status");
  const status = useQuery(accountStatusQueryOptions());
  const [target, setTarget] = React.useState<StandingTarget>(null);

  if (status.isPending) {
    return (
      <>
        <Heading />
        <div aria-busy="true" role="status">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (!status.data) {
    return (
      <>
        <Heading />
        <LoadError
          isFetching={status.isFetching}
          onRetry={() => void status.refetch()}
        />
      </>
    );
  }

  const standing = standingFromAccountStatus(status.data);

  return (
    <>
      <Heading />
      <Hero standing={standing} />
      {hasHistoryOf(status.data) ? (
        <HistoryTable onOpen={setTarget} params={params} />
      ) : null}
      <DetailSheet onTarget={setTarget} standing={standing} target={target} />
    </>
  );
};
