import { useInfiniteQuery } from "@tanstack/react-query";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { AiActionIcon } from "@/components/ai/action-icon";
import { DateFormat } from "@/components/date-format";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  type AiActionTranslate,
  translateAiActionText,
} from "@/lib/ai/action-text";
import { formatAiPoints } from "@/lib/ai/format-points";
import { aiRunStatusVariant, isAiRunStatus } from "@/lib/ai/run-status";
import { AI_USAGE_TONE_BAR, aiUsageTone } from "@/lib/ai/usage-tone";

import type { AiHistoryItem, AiUsage, AiUsageAction } from "./ai-usage-query";

import { aiHistoryQueryOptions } from "./ai-usage-query";

const FEATURE_RUNS_PAGE = 5;

const AiUsageNoticeContent = ({ usage }: { usage: AiUsage }) => {
  const t = useTranslations("core.auth.settings.ai.notice");
  const format = useFormatter();
  const resetsAt = format.dateTime(new Date(usage.resetsAt), {
    dateStyle: "long",
  });

  if (!usage.enabled) {
    return (
      <Alert variant="info">
        <AlertTitle>{t("disabled.title")}</AlertTitle>
        <AlertDescription>{t("disabled.desc")}</AlertDescription>
      </Alert>
    );
  }

  if (usage.sitePaused || usage.notice === "site_paused") {
    return (
      <Alert variant="info">
        <AlertTitle>{t("site_paused.title")}</AlertTitle>
        <AlertDescription>{t("site_paused.desc")}</AlertDescription>
      </Alert>
    );
  }

  if (usage.notice === "no_allowance") {
    return (
      <Alert variant="info">
        <AlertTitle>{t("no_allowance.title")}</AlertTitle>
        <AlertDescription>{t("no_allowance.desc")}</AlertDescription>
      </Alert>
    );
  }

  if (usage.notice === "exhausted") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("exhausted.title")}</AlertTitle>
        <AlertDescription>{t("exhausted.desc", { resetsAt })}</AlertDescription>
      </Alert>
    );
  }

  if (usage.notice === "near_limit") {
    return (
      <Alert variant="warning">
        <AlertTitle>{t("near_limit.title")}</AlertTitle>
        <AlertDescription>
          {t("near_limit.desc", { resetsAt })}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

export const AiPointsContent = ({ usage }: { usage: AiUsage }) => {
  const t = useTranslations("core.auth.settings.ai.points");
  const locale = useLocale();
  const format = useFormatter();
  const { available, reserved, total, used } = usage.points;
  const usedLabel = formatAiPoints(used, locale);

  if (total === null) {
    return (
      <p className="text-sm leading-relaxed">
        <span className="font-medium">{t("unlimited")}</span>{" "}
        <span className="text-muted-foreground tabular-nums">
          {t("unlimited_used", { used: usedLabel })}
        </span>
      </p>
    );
  }

  const totalValue = Number(total);
  if (totalValue <= 0) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("none")}
      </p>
    );
  }

  const spent = Number(used) + Number(reserved);
  const share = spent / totalValue;
  const tone = aiUsageTone(share);
  const usedOf = t("used_of", {
    total: formatAiPoints(total, locale),
    used: usedLabel,
  });

  return (
    <Progress
      getAriaValueText={() => usedOf}
      indicatorClassName={AI_USAGE_TONE_BAR[tone]}
      max={totalValue}
      min={0}
      value={Math.min(Math.max(spent, 0), totalValue)}
    >
      <ProgressLabel className="tabular-nums">
        {t("left", {
          available: formatAiPoints(available, locale),
          total: formatAiPoints(total, locale),
        })}
      </ProgressLabel>
      <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm tabular-nums sm:ms-auto">
        <span
          className={
            tone === "critical" ? "text-destructive font-medium" : undefined
          }
        >
          {t("percent_used", {
            percent: format.number(Math.min(share, 1), {
              maximumFractionDigits: 0,
              style: "percent",
            }),
          })}
        </span>
        <span aria-hidden>·</span>
        <span>
          {t("renews", {
            date: format.dateTime(new Date(usage.resetsAt), {
              dateStyle: "long",
            }),
          })}
        </span>
      </span>
    </Progress>
  );
};

const AiRunStatusLabel = ({ status }: { status: string }) => {
  const t = useTranslations("core.auth.settings.ai.status");

  return (
    <Badge variant={aiRunStatusVariant(status)}>
      {isAiRunStatus(status) ? t(status) : status}
    </Badge>
  );
};

const AiFeatureRunRow = ({ item }: { item: AiHistoryItem }) => {
  const t = useTranslations("core.auth.settings.ai.features");
  const locale = useLocale();

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
      <span className="text-muted-foreground text-xs tabular-nums">
        <DateFormat date={item.createdAt} />
      </span>
      <span className="flex items-center gap-3">
        {item.status === "succeeded" ? null : (
          <AiRunStatusLabel status={item.status} />
        )}
        <span className="w-24 text-end text-xs tabular-nums">
          {item.chargedPoints !== null
            ? t("charge", {
                points: formatAiPoints(item.chargedPoints, locale),
              })
            : item.status === "running" || item.status === "reserved"
              ? t("charging")
              : t("no_charge")}
        </span>
      </span>
    </li>
  );
};

const AiFeatureRunsContent = ({
  actionKey,
  userId,
}: {
  actionKey: string;
  userId: number;
}) => {
  const t = useTranslations("core.auth.settings.ai.features");
  const runs = useInfiniteQuery(
    aiHistoryQueryOptions({
      action: actionKey,
      limit: FEATURE_RUNS_PAGE,
      userId,
    }),
  );

  if (runs.isPending) {
    return (
      <div className="flex justify-center py-2">
        <Spinner />
      </div>
    );
  }

  if (runs.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground">{t("runs_error")}</p>
        <Button
          onClick={() => {
            void runs.refetch();
          }}
          size="sm"
          variant="outline"
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  const items = runs.data.pages.flatMap(page => page.items);

  if (items.length === 0) {
    return <p className="text-muted-foreground">{t("runs_empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y border-y">
        {items.map(item => (
          <AiFeatureRunRow item={item} key={item.id} />
        ))}
      </ul>
      {runs.hasNextPage ? (
        <Button
          className="self-start"
          isLoading={runs.isFetchingNextPage}
          onClick={() => {
            void runs.fetchNextPage();
          }}
          size="sm"
          variant="ghost"
        >
          {t("show_more")}
        </Button>
      ) : null}
    </div>
  );
};

const AiFeatureRow = ({
  action,
  userId,
}: {
  action: AiUsageAction;
  userId: number;
}) => {
  const t = useTranslations("core.auth.settings.ai.features");
  const tAll = useTranslations() as unknown as AiActionTranslate;
  const locale = useLocale();
  const title = translateAiActionText(tAll, action.title);
  const description = action.description
    ? translateAiActionText(tAll, action.description)
    : null;
  const isFull =
    action.dailyLimit !== null && action.usedToday >= action.dailyLimit;
  const usage = (
    <>
      {isFull ? (
        <Badge variant="destructive">{t("limit_reached")}</Badge>
      ) : (
        <span className="text-sm font-normal tabular-nums">
          {action.dailyLimit === null
            ? t("today_no_limit", { used: action.usedToday })
            : t("today", { limit: action.dailyLimit, used: action.usedToday })}
        </span>
      )}
      {Number(action.monthPoints) > 0 ? (
        <span className="text-muted-foreground text-xs font-normal tabular-nums">
          {t("month_points", {
            points: formatAiPoints(action.monthPoints, locale),
          })}
        </span>
      ) : null}
    </>
  );

  return (
    <AccordionItem value={action.key}>
      <AccordionTrigger className="min-w-0 items-center gap-3 px-4 py-3">
        <span className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <AiActionIcon enabled={!isFull} icon={action.icon} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-medium">{title}</span>
            {description ? (
              <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed font-normal text-pretty">
                {description}
              </span>
            ) : null}
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 sm:hidden">
              {usage}
            </span>
          </span>
          <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
            {usage}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-3 px-4 sm:ps-16">
        <p className="text-muted-foreground leading-relaxed text-pretty">
          {action.dailyLimit === null
            ? t("no_limit_desc")
            : t("limit_desc", { limit: action.dailyLimit })}
        </p>
        <AiFeatureRunsContent actionKey={action.key} userId={userId} />
      </AccordionContent>
    </AccordionItem>
  );
};

export const AiFeaturesContent = ({
  actions,
  userId,
}: {
  actions: AiUsageAction[];
  userId: number;
}) => {
  const t = useTranslations("core.auth.settings.ai.features");

  return (
    <section
      aria-labelledby="ai-features-title"
      className="flex flex-col gap-2"
    >
      <h3
        className="text-muted-foreground text-sm font-medium"
        id="ai-features-title"
      >
        {t("title")}
      </h3>
      {actions.length === 0 ? (
        <div className="bg-card ring-foreground/10 flex flex-col gap-1 rounded-md p-6 text-center shadow-xs ring-1">
          <p className="text-sm font-medium">{t("empty_title")}</p>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("empty_desc")}
          </p>
        </div>
      ) : (
        <Accordion className="bg-card ring-foreground/10 overflow-hidden rounded-md shadow-xs ring-1">
          {actions.map(action => (
            <AiFeatureRow action={action} key={action.key} userId={userId} />
          ))}
        </Accordion>
      )}
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("footer")}
      </p>
    </section>
  );
};

export const AiUsageContent = ({
  usage,
  userId,
}: {
  usage: AiUsage;
  userId: number;
}) => (
  <div className="flex flex-col gap-6">
    <section className="bg-card ring-foreground/10 rounded-md p-4 shadow-xs ring-1">
      <AiPointsContent usage={usage} />
    </section>
    <AiUsageNoticeContent usage={usage} />
    <AiFeaturesContent actions={usage.actions} userId={userId} />
  </div>
);
