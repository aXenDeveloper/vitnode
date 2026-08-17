// No "use client": reached only from `schedule-action`, which is a client entry.
import {
  CalendarClockIcon,
  CheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";
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
import {
  cancelContentScheduleAction,
  listContentSchedulesAction,
  scheduleContentAction,
} from "../mutation-api.server";

const formSchema = z.object({
  action: z.enum(["publish", "unpublish"]),
  scheduledFor: z.iso.datetime(),
});

/** One row in the list of what is booked and what already ran. */
const ScheduleRow = ({
  now,
  onCancel,
  schedule,
}: {
  /** Passed in rather than read here: render must not call the clock. */
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

      {/* A different thing from `lastError`, and it reads as one: the record
          really did publish, and what is still being retried is the event, the
          search write and the cache invalidation. */}
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

/**
 * Everything scheduled for one record, and the form that adds another.
 *
 * Lazy-loaded like the edit form and the history dialog, and for the same
 * reason: it is only ever in the tree while its own dialog is open.
 */
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
  const [state, setState] = React.useState<null | {
    edges: ContentSchedule[];
    hasCronAdapter: boolean;
    /** When the list was fetched, so "overdue" is decided outside render. */
    loadedAt: number;
  }>(null);

  const reload = React.useCallback(async () => {
    const result = await listContentSchedulesAction(contentTypeId, id);

    setState({
      edges: result.edges,
      hasCronAdapter: result.hasCronAdapter,

      loadedAt: Date.now(),
    });
  }, [contentTypeId, id]);

  React.useEffect(() => {
    let active = true;

    void listContentSchedulesAction(contentTypeId, id).then(result => {
      if (!active) return;

      setState({
        edges: result.edges,
        hasCronAdapter: result.hasCronAdapter,

        loadedAt: Date.now(),
      });
    });

    return () => {
      active = false;
    };
  }, [contentTypeId, id]);

  if (!state) return <Loader />;

  const pending = state.edges.filter(entry => entry.status === "pending");

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    // The same pure rule the server enforces, run before the round trip so an
    // impossible date is refused where the editor is looking. The server stays
    // the authority; this is only faster.
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

    const mutation = await scheduleContentAction(
      contentTypeId,
      id,
      values.action,
      new Date(values.scheduledFor).toISOString(),
    );

    if (mutation.error !== undefined) {
      // A refused schedule has its own words - "that time has passed" is
      // actionable, "something went wrong" is not.
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
    await reload();
  };

  return (
    <div className="flex flex-col gap-4">
      {!state.hasCronAdapter ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>{t("no_cron.title")}</AlertTitle>
          <AlertDescription>{t("no_cron.desc")}</AlertDescription>
        </Alert>
      ) : null}

      {state.edges.length > 0 ? (
        <ul className="flex flex-col">
          {state.edges.map(schedule => (
            <ScheduleRow
              key={schedule.id}
              now={state.loadedAt}
              onCancel={async scheduleId => {
                const mutation = await cancelContentScheduleAction(
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
                await reload();
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
                // The values come from the schema's enum; this only translates
                // them for display.
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
