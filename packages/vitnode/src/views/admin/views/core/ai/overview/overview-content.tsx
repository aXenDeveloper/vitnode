import { Link } from "@tanstack/react-router";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatAiUsd } from "@/lib/ai/format-points";

import type { AdminAiOverview, AiBreakdownRow } from "../ai-query";

import { AiActionLabel, AiUsd, formatAiShare } from "../ai-labels";

const AiStatCard = ({
  children,
  label,
  value,
}: {
  children?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
}) => (
  <Card size="sm">
    <CardHeader>
      <CardDescription>{label}</CardDescription>
      <CardTitle className="text-2xl font-semibold tabular-nums">
        {value}
      </CardTitle>
    </CardHeader>
    {children ? (
      <CardContent className="text-muted-foreground flex flex-col gap-2 leading-relaxed text-pretty">
        {children}
      </CardContent>
    ) : null}
  </Card>
);

const AiBudgetCard = ({ data }: { data: AdminAiOverview }) => {
  const t = useTranslations("admin.ai.overview.budget");
  const locale = useLocale();
  const { limitUsd, remainingUsd, reservedUsd, spentUsd } = data.budget;
  const limit = limitUsd === null ? null : Number(limitUsd);

  return (
    <AiStatCard label={t("spent")} value={<AiUsd value={spentUsd} />}>
      {limit === null ? (
        <span>
          {t("no_limit")}{" "}
          <Link
            className="text-foreground underline underline-offset-3"
            to="/admin/core/ai/settings"
          >
            {t("set_limit")}
          </Link>
        </span>
      ) : (
        <Progress
          getAriaValueText={() =>
            t("of_limit", {
              limit: formatAiUsd(limitUsd, locale),
              spent: formatAiUsd(spentUsd, locale),
            })
          }
          max={Math.max(limit, 0)}
          min={0}
          value={Math.min(Number(spentUsd), Math.max(limit, 0))}
        >
          <ProgressLabel className="sr-only">{t("spent")}</ProgressLabel>
          <span className="text-sm tabular-nums">
            {t("remaining", { remaining: formatAiUsd(remainingUsd, locale) })}
          </span>
        </Progress>
      )}
      <span>
        {t("reserved", { reserved: formatAiUsd(reservedUsd, locale) })}
      </span>
    </AiStatCard>
  );
};

const AiCoverageCard = ({ data }: { data: AdminAiOverview }) => {
  const t = useTranslations("admin.ai.overview.coverage");
  const locale = useLocale();
  const { estimated, provider, unknown } = data.costSources;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription className="leading-relaxed text-pretty">
          {t("summary", {
            share: formatAiShare(data.pricingCoverage, locale),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-3 gap-2">
          {(
            [
              ["provider", provider],
              ["estimated", estimated],
              ["unknown", unknown],
            ] as const
          ).map(([key, value]) => (
            <div className="flex flex-col gap-0.5" key={key}>
              <dt className="text-muted-foreground text-xs">{t(key)}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {unknown > 0 ? t("unknown_hint") : t("all_known_hint")}
        </p>
      </CardContent>
    </Card>
  );
};

const AiAltCard = ({ data }: { data: AdminAiOverview }) => {
  const t = useTranslations("admin.ai.overview.alt");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription className="leading-relaxed text-pretty">
          {t("desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">{t("images")}</dt>
            <dd className="font-semibold tabular-nums">
              {data.alt.imagesDescribed}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">
              {t("translations")}
            </dt>
            <dd className="font-semibold tabular-nums">
              {data.alt.translations}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">{t("per_image")}</dt>
            <dd className="font-semibold">
              <AiUsd value={data.alt.perImageUsd} />
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">
              {t("per_translation")}
            </dt>
            <dd className="font-semibold">
              <AiUsd value={data.alt.perTranslationUsd} />
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
};

const AiBreakdownTable = ({
  label,
  rows,
}: {
  label: (key: string) => React.ReactNode;
  rows: AiBreakdownRow[];
}) => {
  const t = useTranslations("admin.ai.overview.breakdown");
  const locale = useLocale();

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {t("empty")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("name")}</TableHead>
          <TableHead className="text-end">{t("operations")}</TableHead>
          <TableHead className="text-end">{t("failures")}</TableHead>
          <TableHead className="text-end">{t("known_cost")}</TableHead>
          <TableHead className="text-end">{t("coverage")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.key}>
            <TableCell className="max-w-xs">{label(row.key)}</TableCell>
            <TableCell className="text-end tabular-nums">
              {row.operations}
            </TableCell>
            <TableCell className="text-end tabular-nums">
              {row.failures}
            </TableCell>
            <TableCell className="text-end">
              <AiUsd
                value={
                  row.knownOperations === 0 && row.operations > 0
                    ? null
                    : row.knownCostUsd
                }
              />
            </TableCell>
            <TableCell className="text-end tabular-nums">
              {formatAiShare(
                row.operations === 0 ? 1 : row.knownOperations / row.operations,
                locale,
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const AiBreakdownCard = ({
  data,
  describeAction,
}: {
  data: AdminAiOverview;
  describeAction: (key: string) => null | string;
}) => {
  const t = useTranslations("admin.ai.overview.breakdown");
  const tOrigin = useTranslations("admin.ai.origin");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs className="gap-4" defaultValue="action">
          <TabsList aria-label={t("title")}>
            <TabsTrigger value="action">{t("by_action")}</TabsTrigger>
            <TabsTrigger value="model">{t("by_model")}</TabsTrigger>
            <TabsTrigger value="origin">{t("by_origin")}</TabsTrigger>
          </TabsList>
          <TabsPanels>
            <TabsContent value="action">
              <AiBreakdownTable
                label={key => (
                  <AiActionLabel
                    actionKey={key}
                    description={describeAction(key)}
                  />
                )}
                rows={data.byAction}
              />
            </TabsContent>
            <TabsContent value="model">
              <AiBreakdownTable
                label={key => <span className="font-mono text-xs">{key}</span>}
                rows={data.byModel}
              />
            </TabsContent>
            <TabsContent value="origin">
              <AiBreakdownTable
                label={key =>
                  key === "system" || key === "user" ? tOrigin(key) : key
                }
                rows={data.byOrigin}
              />
            </TabsContent>
          </TabsPanels>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export const AiOverviewContent = ({
  data,
  describeAction,
}: {
  data: AdminAiOverview;
  describeAction: (key: string) => null | string;
}) => {
  const t = useTranslations("admin.ai.overview");
  const locale = useLocale();
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-6">
      {data.enabled ? null : (
        <Alert variant="warning">
          <AlertTitle>{t("disabled.title")}</AlertTitle>
          <AlertDescription>
            {t("disabled.desc")}{" "}
            <Link to="/admin/core/ai/settings">{t("disabled.link")}</Link>
          </AlertDescription>
        </Alert>
      )}

      <p className="text-muted-foreground text-sm">
        {t("period_range", {
          end: format.dateTime(new Date(data.period.end), {
            dateStyle: "medium",
          }),
          start: format.dateTime(new Date(data.period.start), {
            dateStyle: "medium",
          }),
        })}
      </p>

      <section
        aria-label={t("stats_label")}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <AiBudgetCard data={data} />
        <AiStatCard label={t("operations")} value={data.operations}>
          {t("failure_rate", {
            share: formatAiShare(data.failureRate, locale),
          })}
        </AiStatCard>
        <AiStatCard
          label={t("average_operation")}
          value={<AiUsd value={data.averageOperationCostUsd} />}
        >
          {t("average_daily", {
            amount: formatAiUsd(data.averageDailyCostUsd, locale),
          })}
        </AiStatCard>
        <AiStatCard
          label={t("tokens")}
          value={format.number(data.tokens.input + data.tokens.output, {
            notation: "compact",
          })}
        >
          {t("tokens_split", {
            input: format.number(data.tokens.input),
            output: format.number(data.tokens.output),
          })}
        </AiStatCard>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <AiCoverageCard data={data} />
        <AiAltCard data={data} />
      </div>

      {data.budget.systemLimitUsd === null &&
      Number(data.budget.systemSpentUsd) === 0 ? null : (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("system_budget", {
            limit:
              data.budget.systemLimitUsd === null
                ? t("system_no_limit")
                : formatAiUsd(data.budget.systemLimitUsd, locale),
            spent: formatAiUsd(data.budget.systemSpentUsd, locale),
          })}
        </p>
      )}

      <AiBreakdownCard data={data} describeAction={describeAction} />
    </div>
  );
};
