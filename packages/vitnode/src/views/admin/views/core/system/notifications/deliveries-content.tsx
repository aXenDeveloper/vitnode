import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { InboxIcon, RotateCwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type { NotificationsAdminActions } from "./notifications-mutations";
import type { AdminNotificationDelivery } from "./notifications-query";
import type { NotificationDeliveryStatus } from "./statuses";

import { DeliveryStatusBadge } from "./delivery-status-badge";
import { notificationDeliveriesQueryOptions } from "./notifications-query";
import { NOTIFICATION_DELIVERY_STATUSES } from "./statuses";

const ALL = "all";

const isDeliveryStatus = (value: string): value is NotificationDeliveryStatus =>
  (NOTIFICATION_DELIVERY_STATUSES as readonly string[]).includes(value);

const RetryDeliveryButton = ({
  id,
  onRetry,
}: {
  id: number;
  onRetry: NotificationsAdminActions["retryDelivery"];
}) => {
  const t = useTranslations("admin.system.notifications.deliveries.retry");
  const tError = useTranslations("core.global.errors");
  const [, formAction, isPending] = React.useActionState(async () => {
    const mutation = await onRetry(id);

    if (mutation.error !== undefined) {
      toast.error(tError("title"), {
        description:
          mutation.status === 409
            ? t("conflict")
            : tError("internal_server_error"),
      });

      return null;
    }

    toast.success(t("success"), { description: t("success_desc", { id }) });

    return null;
  }, null);

  return (
    <form action={formAction}>
      <TooltipWithContent text={t("label", { id })}>
        <Button
          aria-label={t("label", { id })}
          isLoading={isPending}
          size="icon"
          type="submit"
          variant="ghost"
        >
          <RotateCwIcon aria-hidden />
        </Button>
      </TooltipWithContent>
    </form>
  );
};

const DeliveryRow = ({
  canManage,
  delivery,
  onRetry,
}: {
  canManage: boolean;
  delivery: AdminNotificationDelivery;
  onRetry: NotificationsAdminActions["retryDelivery"];
}) => {
  const t = useTranslations("admin.system.notifications.deliveries");
  const problem = delivery.lastError ?? delivery.skipReason;

  return (
    <TableRow>
      <TableCell className="tabular-nums">{delivery.id}</TableCell>
      <TableCell>
        <div className="flex max-w-xs flex-col gap-1">
          <span className="truncate font-mono text-xs">
            {delivery.type ?? (delivery.mode === "test" ? t("test_type") : "—")}
          </span>
          <span className="text-muted-foreground text-xs">
            {t("items", { count: delivery.itemCount })}
          </span>
        </div>
      </TableCell>
      <TableCell>{t(`modes.${delivery.mode}`)}</TableCell>
      <TableCell>
        <DeliveryStatusBadge status={delivery.status} />
      </TableCell>
      <TableCell className="tabular-nums">
        {delivery.attempts}/{delivery.maxAttempts}
      </TableCell>
      <TableCell>
        {problem ? (
          <span
            className={
              delivery.lastError
                ? "text-destructive line-clamp-2 max-w-xs text-sm whitespace-normal"
                : "text-muted-foreground line-clamp-2 max-w-xs text-sm whitespace-normal"
            }
            title={problem}
          >
            {problem}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {t("user_id", { id: delivery.userId })}
      </TableCell>
      <TableCell>
        <DateFormat date={delivery.updatedAt} />
      </TableCell>
      <TableCell className="text-end">
        {canManage && delivery.status === "failed" ? (
          <RetryDeliveryButton id={delivery.id} onRetry={onRetry} />
        ) : null}
      </TableCell>
    </TableRow>
  );
};

const DeliveriesSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-2">
    {["a", "b", "c", "d"].map(id => (
      <Skeleton className="h-10 w-full" key={id} />
    ))}
  </div>
);

const DeliveriesTable = ({
  canManage,
  onRetry,
  status,
}: {
  canManage: boolean;
  onRetry: NotificationsAdminActions["retryDelivery"];
  status?: NotificationDeliveryStatus;
}) => {
  const t = useTranslations("admin.system.notifications.deliveries");
  const tPage = useTranslations("admin.system.notifications.load_error");
  const tError = useTranslations("core.global.errors");
  const query = useInfiniteQuery({
    ...notificationDeliveriesQueryOptions({ status }),
    placeholderData: keepPreviousData,
  });

  if (query.isPending) return <DeliveriesSkeleton />;

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{tPage("title")}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <p>{tPage("desc")}</p>
          <Button
            onClick={() => {
              void query.refetch();
            }}
            size="sm"
            variant="outline"
          >
            {tError("try_again")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const deliveries = query.data.pages.flatMap(page => page.items);

  if (deliveries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.desc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div
      aria-busy={query.isFetching}
      className="flex flex-col items-center gap-4"
    >
      <Table>
        <TableCaption className="sr-only">{t("caption")}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t("id")}</TableHead>
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("mode")}</TableHead>
            <TableHead>{t("state")}</TableHead>
            <TableHead>{t("attempts")}</TableHead>
            <TableHead>{t("error")}</TableHead>
            <TableHead>{t("user")}</TableHead>
            <TableHead>{t("updated")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map(delivery => (
            <DeliveryRow
              canManage={canManage}
              delivery={delivery}
              key={delivery.id}
              onRetry={onRetry}
            />
          ))}
        </TableBody>
      </Table>

      {query.hasNextPage ? (
        <Button
          isLoading={query.isFetchingNextPage}
          onClick={() => {
            void query.fetchNextPage();
          }}
          variant="outline"
        >
          {t("load_more")}
        </Button>
      ) : null}
    </div>
  );
};

export const NotificationsDeliveriesCard = ({
  canManage,
  onRetry,
}: {
  canManage: boolean;
  onRetry: NotificationsAdminActions["retryDelivery"];
}) => {
  const t = useTranslations("admin.system.notifications.deliveries");
  const tStatus = useTranslations("admin.system.notifications.status");
  const filterId = React.useId();
  const [status, setStatus] = React.useState<NotificationDeliveryStatus>();

  return (
    <Card aria-labelledby="notifications-deliveries" role="region">
      <CardHeader>
        <CardTitle>
          <h2 className="text-balance" id="notifications-deliveries">
            {t("title")}
          </h2>
        </CardTitle>
        <CardDescription className="leading-relaxed text-pretty">
          {t("desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Label className="font-normal" htmlFor={filterId}>
            {t("filter")}
          </Label>
          <NativeSelect
            id={filterId}
            onChange={event => {
              const next = event.target.value;
              setStatus(isDeliveryStatus(next) ? next : undefined);
            }}
            size="sm"
            value={status ?? ALL}
          >
            <NativeSelectOption value={ALL}>{t("all")}</NativeSelectOption>
            {NOTIFICATION_DELIVERY_STATUSES.map(option => (
              <NativeSelectOption key={option} value={option}>
                {tStatus(option)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <DeliveriesTable
          canManage={canManage}
          onRetry={onRetry}
          status={status}
        />
      </CardContent>
    </Card>
  );
};
