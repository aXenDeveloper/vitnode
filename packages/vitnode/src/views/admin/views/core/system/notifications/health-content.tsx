import {
  ClockIcon,
  HourglassIcon,
  type LucideIcon,
  MailIcon,
  SendIcon,
  ZapIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type {
  NotificationEmailHealth,
  NotificationHealthSummary,
  NotificationWorkerHealth,
} from "./health";

import {
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_EVENT_STATUSES,
} from "./statuses";

const EMAIL_BADGE = {
  disabled: "secondary",
  missing: "warning",
  ready: "success",
} as const satisfies Record<NotificationEmailHealth, string>;

const WORKER_BADGE = {
  active: "success",
  inactive: "destructive",
  stale: "warning",
} as const satisfies Record<NotificationWorkerHealth, string>;

const HealthCard = ({
  badge,
  children,
  description,
  Icon,
  title,
}: {
  badge?: React.ReactNode;
  children?: React.ReactNode;
  description: string;
  Icon: LucideIcon;
  title: string;
}) => (
  <Card size="sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-balance">
        <Icon aria-hidden className="text-muted-foreground size-4" />
        {title}
      </CardTitle>
      {badge ? <CardAction>{badge}</CardAction> : null}
      <CardDescription className="leading-relaxed text-pretty">
        {description}
      </CardDescription>
    </CardHeader>
    {children ? <CardContent>{children}</CardContent> : null}
  </Card>
);

const CountList = <S extends string>({
  counts,
  label,
  statuses,
}: {
  counts: Record<S, number>;
  label: (status: S) => string;
  statuses: readonly S[];
}) => (
  <dl className="grid grid-cols-2 gap-2">
    {statuses.map(status => (
      <div className="bg-muted flex flex-col gap-1 rounded-md p-2" key={status}>
        <dt className="text-muted-foreground text-xs">{label(status)}</dt>
        <dd className="text-lg font-semibold tabular-nums">
          {counts[status].toLocaleString()}
        </dd>
      </div>
    ))}
  </dl>
);

export const NotificationsHealthContent = ({
  oldestPendingEventAt,
  summary,
}: {
  oldestPendingEventAt: Date | null | string;
  summary: NotificationHealthSummary;
}) => {
  const t = useTranslations("admin.system.notifications.health");
  const tStatus = useTranslations("admin.system.notifications.status");

  return (
    <section
      aria-labelledby="notifications-health"
      className="flex flex-col gap-4"
    >
      <h2
        className="text-lg font-semibold text-balance"
        id="notifications-health"
      >
        {t("title")}
      </h2>

      {summary.warnings.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>{t("warnings.title")}</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 ps-4">
              {summary.warnings.map(warning => (
                <li key={warning.kind}>
                  {"count" in warning
                    ? t(`warnings.${warning.kind}`, { count: warning.count })
                    : t(`warnings.${warning.kind}`)}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HealthCard
          badge={
            <Badge variant={EMAIL_BADGE[summary.email]}>
              {t(`email.${summary.email}`)}
            </Badge>
          }
          description={t(`email.${summary.email}_desc`)}
          Icon={MailIcon}
          title={t("email.title")}
        />

        <HealthCard
          badge={
            <Badge variant={WORKER_BADGE[summary.worker]}>
              {t(`worker.${summary.worker}`)}
            </Badge>
          }
          description={t(`worker.${summary.worker}_desc`)}
          Icon={ClockIcon}
          title={t("worker.title")}
        >
          {summary.failedQueueTasks > 0 ? (
            <p className="text-destructive text-sm leading-relaxed">
              {t("failed_queue", { count: summary.failedQueueTasks })}
            </p>
          ) : null}
        </HealthCard>

        <HealthCard
          description={
            oldestPendingEventAt ? t("oldest.desc") : t("oldest.none_desc")
          }
          Icon={HourglassIcon}
          title={t("oldest.title")}
        >
          <p className="text-lg font-semibold">
            {oldestPendingEventAt ? (
              <DateFormat date={oldestPendingEventAt} />
            ) : (
              t("oldest.none")
            )}
          </p>
        </HealthCard>

        <HealthCard
          description={t("events.desc")}
          Icon={ZapIcon}
          title={t("events.title")}
        >
          <CountList
            counts={summary.events}
            label={status => tStatus(status)}
            statuses={NOTIFICATION_EVENT_STATUSES}
          />
        </HealthCard>

        <HealthCard
          description={t("deliveries.desc")}
          Icon={SendIcon}
          title={t("deliveries.title")}
        >
          <CountList
            counts={summary.deliveries}
            label={status => tStatus(status)}
            statuses={NOTIFICATION_DELIVERY_STATUSES}
          />
        </HealthCard>
      </div>
    </section>
  );
};
