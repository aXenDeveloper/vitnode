import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMoneyFormatter } from "@/views/payments/money-text";

import type { PaymentsOverview } from "./payments-admin-query";

const WorkerStatus = ({ worker }: { worker: PaymentsOverview["worker"] }) => {
  const t = useTranslations("admin.payments.overview");
  const format = useFormatter();
  const healthy =
    !worker.stale && worker.queueLagging === 0 && !!worker.lastRun;
  const lastRun = worker.lastRun
    ? t("last_run", {
        date: format.dateTime(new Date(worker.lastRun), {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      })
    : t("never_run");

  return (
    <Alert
      icon={healthy ? <CheckCircle2Icon /> : <AlertTriangleIcon />}
      variant={healthy ? "success" : "warning"}
    >
      <AlertTitle>{t("worker")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1 leading-relaxed">
        <span>{healthy ? t("worker_ok") : t("worker_stale")}</span>
        {worker.queueLagging > 0 ? (
          <span>{t("worker_lagging", { count: worker.queueLagging })}</span>
        ) : null}
        {!worker.hasCronAdapter ? <span>{t("worker_no_adapter")}</span> : null}
        <span className="text-muted-foreground">{lastRun}</span>
      </AlertDescription>
    </Alert>
  );
};

export const PaymentsOverviewContent = ({
  data,
}: {
  data: PaymentsOverview;
}) => {
  const t = useTranslations("admin.payments");
  const formatMoney = useMoneyFormatter();
  const attention = [
    ["fulfillments_failed", data.attention.fulfillmentsFailed],
    ["events_failed", data.attention.eventsFailed],
    ["disputes", data.attention.disputesOpen],
    ["subscriptions_attention", data.attention.subscriptionsNeedingAttention],
    ["processing", data.attention.purchasesProcessing],
    ["fulfillments_pending", data.attention.fulfillmentsPending],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {data.enabled ? null : (
        <Alert variant="info">
          <AlertDescription>{t("disabled")}</AlertDescription>
        </Alert>
      )}

      <WorkerStatus worker={data.worker} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("overview.totals")}</CardTitle>
            <CardDescription>{t("overview.totals_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.totals.length === 0 ? (
              <p className="text-muted-foreground leading-relaxed">
                {t("overview.no_totals")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.totals.map(total => (
                  <li className="flex flex-col gap-1" key={total.currency}>
                    <span className="font-medium">{total.currency}</span>
                    <dl className="text-muted-foreground grid grid-cols-3 gap-2 text-sm tabular-nums">
                      <div>
                        <dt>{t("overview.one_time")}</dt>
                        <dd className="text-foreground">
                          {formatMoney({
                            amount: total.oneTime,
                            currency: total.currency,
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("overview.recurring")}</dt>
                        <dd className="text-foreground">
                          {formatMoney({
                            amount: total.recurring,
                            currency: total.currency,
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("overview.refunded")}</dt>
                        <dd className="text-foreground">
                          {formatMoney({
                            amount: total.refunded,
                            currency: total.currency,
                          })}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{t("overview.attention")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {attention.map(([key, value]) => (
                <div className="flex flex-col gap-1" key={key}>
                  <dt className="text-muted-foreground">
                    {t(`overview.${key}`)}
                  </dt>
                  <dd>
                    <Badge
                      variant={
                        value > 0 &&
                        key !== "processing" &&
                        key !== "fulfillments_pending"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {value}
                    </Badge>
                  </dd>
                </div>
              ))}
            </dl>
            {data.providers.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {t("overview.providers")}
                </span>
                {data.providers.map(provider => (
                  <Badge key={provider.id} variant="outline">
                    {provider.name} ·{" "}
                    {t("overview.scope", { scope: provider.scope })}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
