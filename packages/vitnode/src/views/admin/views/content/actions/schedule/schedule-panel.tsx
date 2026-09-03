// No "use client": reached only from `schedule-action`, which is a client entry.
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  CheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { ContentSchedule } from "@/content/schedules";

import { DateFormat } from "@/components/date-format";
import { AutoForm } from "@/components/form/auto-form";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormSelect } from "@/components/form/fields/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { contentScheduleTimingError } from "@/content/schedules";

import { contentErrorKey } from "../../lib/mutation-feedback";
import { contentSchedulesQueryOptions } from "../editorial-query";
import { useContentEditorialTransport } from "../editorial-transport";

const formSchema = z.object({
  action: z.enum(["publish", "unpublish"]),
  scheduledFor: z.iso.datetime(),
});

const ScheduleRow = ({
  now,
  onCancel,
  schedule,
}: {
  /** When the schedule list was last read - `dataUpdatedAt`. */
  now: number;
  onCancel: (scheduleId: number) => Promise<void>;
  schedule: ContentSchedule;
}) => {
  const t = useTranslations("core.content.schedule");
  const [cancelling, setCancelling] = React.useState(false);
  const pending = schedule.status === "pending";
  const overdue = pending && new Date(schedule.scheduledFor).getTime() < now;

  return (
    <li className="flex flex-wrap items-center gap-2 border-b py-2 last:border-b-0">
      <Badge variant={pending ? "default" : "secondary"}>
        {t(`actions.${schedule.action}`)}
      </Badge>

      <span className="text-sm">
        <DateFormat date={schedule.scheduledFor} showFullDate />
      </span>

      <span className="text-muted-foreground text-xs">
        {t(`status.${schedule.status}`)}
        {schedule.actorName ? ` · ${schedule.actorName}` : null}
      </span>

      {overdue ? (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {t("overdue")}
        </span>
      ) : null}

      {schedule.lastError ? (
        <span className="text-destructive w-full text-xs wrap-break-word">
          {schedule.lastError}
        </span>
      ) : null}

      {schedule.effectsError ? (
        <span className="w-full text-xs wrap-break-word text-amber-600 dark:text-amber-400">
          {t("effects_failed")}
        </span>
      ) : null}

      {pending ? (
        <Button
          aria-label={t("cancel")}
          className="ml-auto"
          disabled={cancelling}
          isLoading={cancelling}
          onClick={() => {
            setCancelling(true);
            void onCancel(schedule.id).finally(() => {
              setCancelling(false);
            });
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
          {t("cancel")}
        </Button>
      ) : (
        <CheckIcon
          aria-hidden
          className="text-muted-foreground ml-auto size-4"
        />
      )}
    </li>
  );
};

export const SchedulePanel = ({
  contentTypeId,
  id,
  singular,
  title,
}: {
  contentTypeId: string;
  id: number;
  singular: string;
  title: string;
}) => {
  const t = useTranslations("core.content.schedule");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const transport = useContentEditorialTransport();

  const schedules = useQuery(
    contentSchedulesQueryOptions({
      contentTypeId,
      itemId: id,
      listSchedules: transport.listSchedules,
    }),
  );

  const settled = async () => {
    await transport.settled({
      contentTypeId,
      itemId: id,
      scope: "schedules",
    });
  };

  if (schedules.isPending) return <Loader />;

  const edges = schedules.data?.edges ?? [];
  const pending = edges.filter(entry => entry.status === "pending");

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const timing = contentScheduleTimingError({
      action: values.action,
      now: new Date(),
      pending,
      scheduledFor: new Date(values.scheduledFor),
    });

    if (timing) {
      toast.error(tErrors("title"), {
        description: t(
          timing === "CONTENT_SCHEDULE_ORDER"
            ? "errors.order"
            : "errors.in_past",
        ),
      });

      return;
    }

    const mutation = await transport.schedule(
      contentTypeId,
      id,
      values.action,
      new Date(values.scheduledFor).toISOString(),
    );

    if (mutation.error !== undefined) {
      const key = contentErrorKey(mutation.status);
      const description = mutation.rejection
        ? t(
            mutation.rejection.code === "CONTENT_SCHEDULE_ORDER"
              ? "errors.order"
              : mutation.rejection.code === "CONTENT_SCHEDULE_IN_PAST"
                ? "errors.in_past"
                : "errors.unsupported",
          )
        : key
          ? tContentErrors(key)
          : tErrors("internal_server_error");

      toast.error(tErrors("title"), { description });

      return;
    }

    toast.success(t("success", { name: singular }), { description: title });
    await settled();
  };

  return (
    <div className="flex flex-col gap-4">
      {schedules.data?.hasCronAdapter === false ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>{t("no_cron.title")}</AlertTitle>
          <AlertDescription>{t("no_cron.desc")}</AlertDescription>
        </Alert>
      ) : null}

      {edges.length > 0 ? (
        <ul className="flex flex-col">
          {edges.map(schedule => (
            <ScheduleRow
              key={schedule.id}
              now={schedules.dataUpdatedAt}
              onCancel={async scheduleId => {
                const mutation = await transport.cancelSchedule(
                  contentTypeId,
                  id,
                  scheduleId,
                );

                if (mutation.error !== undefined) {
                  const key = contentErrorKey(mutation.status);
                  toast.error(tErrors("title"), {
                    description: key
                      ? tContentErrors(key)
                      : tErrors("internal_server_error"),
                  });

                  return;
                }

                toast.success(t("cancelled"), { description: title });
                await settled();
              }}
              schedule={schedule}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      )}

      <AutoForm
        fields={[
          {
            id: "action",

            component: props => (
              <AutoFormSelect
                label={t("field.action")}
                labels={[
                  { label: t("actions.publish"), value: "publish" },
                  { label: t("actions.unpublish"), value: "unpublish" },
                ]}
                {...props}
              />
            ),
          },
          {
            id: "scheduledFor",

            component: props => (
              <AutoFormDateTime
                description={t("field.when_desc", {
                  zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                })}
                label={t("field.when")}
                {...props}
              />
            ),
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
        submitButtonProps={{ children: t("submit") }}
      />

      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
        <CalendarClockIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {t("precision")}
      </p>
    </div>
  );
};
