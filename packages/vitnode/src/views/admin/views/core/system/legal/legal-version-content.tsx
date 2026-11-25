import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { localizeLegalContent } from "@vitnode/api/lib/legal/contract";
import {
  ExternalLinkIcon,
  MailWarningIcon,
  RotateCwIcon,
  UsersIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LegalDocumentView } from "@/views/legal/legal-document-view";
import { legalBasePath, useLegalDate } from "@/views/legal/legal-format";

import type { AdminLegalVersion } from "./legal-admin-query";

import {
  adminLegalAcceptancesQueryOptions,
  adminLegalDeliveriesQueryOptions,
  legalAdminQueryRoot,
  retryAdminLegalDeliveries,
} from "./legal-admin-query";

const FILTERS = [
  "all",
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
] as const;

const STATUS_VARIANT = {
  failed: "destructive",
  pending: "secondary",
  sending: "secondary",
  sent: "success",
  skipped: "outline",
} as const;

const useRetry = (id: number) => {
  const t = useTranslations("admin.system.legal.delivery");
  const queryClient = useQueryClient();

  return async (deliveryIds?: number[]) => {
    const result = await retryAdminLegalDeliveries(id, deliveryIds);
    if (!result.ok) {
      toast.error(t("retry_error.title"), {
        description: t("retry_error.desc"),
      });

      return;
    }
    toast.success(t("retried.title", { count: result.data.retried }), {
      description: t("retried.desc"),
    });
    await queryClient.invalidateQueries({ queryKey: legalAdminQueryRoot });
  };
};

const DeliveryStats = ({
  canPublish,
  version,
}: {
  canPublish: boolean;
  version: AdminLegalVersion;
}) => {
  const t = useTranslations("admin.system.legal.delivery");
  const formatDate = useLegalDate();
  const retry = useRetry(version.id);
  const [pending, setPending] = React.useState(false);
  const { deliveries, fanout } = version;
  const skipped =
    deliveries.skipped.no_address +
    deliveries.skipped.unverified +
    deliveries.skipped.deleted;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
        <CardDescription className="text-pretty">{t("desc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {fanout?.incidentAt ? (
          <Alert
            icon={<MailWarningIcon aria-hidden="true" />}
            variant="warning"
          >
            <AlertTitle>{t("incident.title")}</AlertTitle>
            <AlertDescription>
              {t("incident.desc", {
                date: formatDate(fanout.incidentAt),
                error: fanout.lastError ?? "-",
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(
            [
              ["total", deliveries.total],
              ["sent", deliveries.sent],
              ["pending", deliveries.pending],
              ["failed", deliveries.failed],
              ["skipped", skipped],
            ] as const
          ).map(([key, value]) => (
            <div
              className="flex flex-col gap-1 rounded-lg border p-3"
              key={key}
            >
              <dt className="text-muted-foreground text-xs">{t(key)}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {skipped > 0 ? (
          <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {(["no_address", "unverified", "deleted"] as const).map(reason =>
              deliveries.skipped[reason] > 0 ? (
                <li key={reason}>
                  {t(`skipped_reasons.${reason}`)}: {deliveries.skipped[reason]}
                </li>
              ) : null,
            )}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            {t(`fanout.${fanout?.status ?? "pending"}`)}
          </p>
          {canPublish && deliveries.failed > 0 ? (
            <Button
              isLoading={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await retry();
                } finally {
                  setPending(false);
                }
              }}
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const DeliveriesTable = ({
  canPublish,
  versionId,
}: {
  canPublish: boolean;
  versionId: number;
}) => {
  const t = useTranslations("admin.system.legal.delivery");
  const tLegal = useTranslations("admin.system.legal");
  const formatDate = useLegalDate();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]>("all");
  const retry = useRetry(versionId);
  const [retrying, setRetrying] = React.useState<null | number>(null);
  const query = useInfiniteQuery(
    adminLegalDeliveriesQueryOptions({
      id: versionId,
      status: filter === "all" ? undefined : filter,
    }),
  );
  const rows = query.data?.pages.flatMap(page => page.items) ?? [];

  return (
    <section aria-labelledby="legal-deliveries" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-semibold" id="legal-deliveries">
          {t("total")}
        </h2>
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor="legal-delivery-filter">{t("table.status")}</Label>
          <NativeSelect
            id="legal-delivery-filter"
            onChange={event => {
              setFilter(event.target.value as (typeof FILTERS)[number]);
            }}
            value={filter}
          >
            {FILTERS.map(item => (
              <NativeSelectOption key={item} value={item}>
                {t(`filter.${item}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {query.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only" role="status">
            {t("title")}
          </span>
          {[0, 1, 2].map(row => (
            <Skeleton className="h-12 w-full" key={row} />
          ))}
        </div>
      ) : query.isError ? (
        <Empty className="border" role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailWarningIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{tLegal("load_error.title")}</EmptyTitle>
            <EmptyDescription>{tLegal("load_error.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              isLoading={query.isFetching}
              onClick={() => void query.refetch()}
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {tLegal("retry")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table aria-busy={query.isFetching}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.member")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.attempts")}</TableHead>
                <TableHead>{t("table.last")}</TableHead>
                <TableHead>{t("table.error")}</TableHead>
                <TableHead className="text-end">
                  <span className="sr-only">{t("retry_one")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        className="font-medium underline-offset-4 hover:underline"
                        to={`/admin/core/users/${row.user.id}`}
                      >
                        {row.user.name}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {row.user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {t(`filter.${row.status}`)}
                      </Badge>
                      {row.skipReason ? (
                        <span className="text-muted-foreground text-xs">
                          {t(`skipped_reasons.${row.skipReason}`)}
                        </span>
                      ) : null}
                      {row.providerMessageId ? (
                        <span
                          className="text-muted-foreground max-w-48 truncate text-xs"
                          title={row.providerMessageId}
                        >
                          {t("table.message_id")}: {row.providerMessageId}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.attempts}</TableCell>
                  <TableCell>
                    {row.lastAttemptAt ? (
                      <time dateTime={row.lastAttemptAt}>
                        {formatDate(row.lastAttemptAt)}
                      </time>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="max-w-64">
                    <span className="line-clamp-2 text-xs">
                      {row.lastError ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    {canPublish && row.status === "failed" ? (
                      <Button
                        disabled={retrying !== null}
                        isLoading={retrying === row.id}
                        onClick={async () => {
                          setRetrying(row.id);
                          try {
                            await retry([row.id]);
                          } finally {
                            setRetrying(null);
                          }
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <RotateCwIcon aria-hidden="true" />
                        {t("retry_one")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {query.hasNextPage ? (
        <Button
          className="self-center"
          isLoading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          variant="outline"
        >
          {t("load_more")}
        </Button>
      ) : null}
    </section>
  );
};

const AcceptancesList = ({ versionId }: { versionId: number }) => {
  const t = useTranslations("admin.system.legal.detail.acceptances");
  const tLegal = useTranslations("admin.system.legal");
  const formatDate = useLegalDate();
  const query = useInfiniteQuery(adminLegalAcceptancesQueryOptions(versionId));
  const rows = query.data?.pages.flatMap(page => page.items) ?? [];

  return (
    <section
      aria-labelledby="legal-acceptances"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2
          className="flex items-center gap-2 text-lg font-semibold"
          id="legal-acceptances"
        >
          <UsersIcon aria-hidden="true" className="size-5" />
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("desc")}</p>
      </div>
      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError ? (
        <Empty className="border" role="alert">
          <EmptyHeader>
            <EmptyTitle>{tLegal("load_error.title")}</EmptyTitle>
            <EmptyDescription>{tLegal("load_error.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              isLoading={query.isFetching}
              onClick={() => void query.refetch()}
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {tLegal("retry")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("accepted_at")}</TableHead>
                <TableHead>{t("locale")}</TableHead>
                <TableHead>{t("source")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      className="underline-offset-4 hover:underline"
                      to={`/admin/core/users/${row.user.id}`}
                    >
                      {row.user.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <time dateTime={row.acceptedAt}>
                      {formatDate(row.acceptedAt)}
                    </time>
                  </TableCell>
                  <TableCell>{row.locale}</TableCell>
                  <TableCell>
                    {t(
                      row.source === "signup" ? "source_signup" : "source_gate",
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {query.hasNextPage ? (
        <Button
          className="self-center"
          isLoading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          variant="outline"
        >
          {t("load_more")}
        </Button>
      ) : null}
    </section>
  );
};

const VersionPreview = ({ version }: { version: AdminLegalVersion }) => {
  const t = useTranslations("admin.system.legal.detail");
  const languages = [
    ...new Set(version.title.map(item => item.languageCode)),
  ].sort();
  const [locale, setLocale] = React.useState(version.defaultLanguageCode);
  const snapshot = localizeLegalContent(
    {
      acceptanceLabel: version.acceptanceLabel,
      body: version.body,
      summary: version.summary,
      title: version.title,
    },
    locale,
    version.defaultLanguageCode,
  );

  return (
    <section
      aria-labelledby="legal-version-content"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-semibold" id="legal-version-content">
          {t("content")}
        </h2>
        {languages.length > 1 ? (
          <div className="flex flex-col gap-2 sm:w-48">
            <Label htmlFor="legal-version-locale">{t("language")}</Label>
            <NativeSelect
              id="legal-version-locale"
              onChange={event => {
                setLocale(event.target.value);
              }}
              value={locale}
            >
              {languages.map(code => (
                <NativeSelectOption key={code} value={code}>
                  {code}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>
      <div className="rounded-xl border p-6">
        <LegalDocumentView
          current={null}
          document={{
            ...snapshot,
            announcedAt: version.announcedAt,
            availableLocales: languages,
            contentHash: version.contentHash,
            documentType: version.documentType,
            effectiveAt: version.effectiveAt,
            id: version.id,
            previousVersion: version.previousVersion,
            requiresAcceptance: version.requiresAcceptance,
            status: version.status,
            version: version.version,
          }}
          preview
          upcoming={null}
        />
      </div>
    </section>
  );
};

/**
 * One announced version in the AdminCP: when and by whom it was published,
 * its fingerprint, the announcement email's delivery (with retry) and, with
 * the records permission, every delivery and acceptance.
 */
export const LegalVersionContent = ({
  canPublish,
  canViewRecords,
  version,
}: {
  canPublish: boolean;
  canViewRecords: boolean;
  version: AdminLegalVersion;
}) => {
  const t = useTranslations("admin.system.legal");
  const formatDate = useLegalDate();
  const base = legalBasePath(version.documentType);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            version.status === "current"
              ? "success"
              : version.status === "upcoming"
                ? "warning"
                : "secondary"
          }
        >
          {t(`status.${version.status}`)}
        </Badge>
        <Badge variant="outline">
          {version.requiresAcceptance
            ? t("requires_acceptance")
            : t("informational")}
        </Badge>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">{t("history.effective")}</dt>
        <dd>
          <time dateTime={version.effectiveAt}>
            {formatDate(version.effectiveAt)}
          </time>
        </dd>
        <dt className="text-muted-foreground">{t("detail.announced_label")}</dt>
        <dd>
          <time dateTime={version.announcedAt}>
            {formatDate(version.announcedAt)}
          </time>
          {version.publishedBy
            ? ` · ${t("detail.published_by", { name: version.publishedBy.name })}`
            : null}
        </dd>
        <dt className="text-muted-foreground">{t("detail.hash")}</dt>
        <dd>
          <code className="text-xs break-all">{version.contentHash}</code>
        </dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <a
          className={buttonVariants({ variant: "outline" })}
          href={`${base}/versions/${version.version}`}
          rel="noopener"
          target="_blank"
        >
          <ExternalLinkIcon aria-hidden="true" />
          {t("detail.public_page")}
        </a>
        {version.previousVersion === null ? null : (
          <a
            className={buttonVariants({ variant: "outline" })}
            href={`${base}/versions/${version.version}/changes`}
            rel="noopener"
            target="_blank"
          >
            <ExternalLinkIcon aria-hidden="true" />
            {t("detail.changes")}
          </a>
        )}
      </div>

      <DeliveryStats canPublish={canPublish} version={version} />

      {canViewRecords ? (
        <DeliveriesTable canPublish={canPublish} versionId={version.id} />
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("delivery.restricted")}
        </p>
      )}

      {version.documentType === "terms" ? (
        canViewRecords ? (
          <AcceptancesList versionId={version.id} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("detail.acceptances.restricted")}
          </p>
        )
      ) : null}

      <VersionPreview version={version} />
    </div>
  );
};
