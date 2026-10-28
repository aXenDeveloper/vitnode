import { useSelector } from "@tanstack/react-form";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormApi } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

import type {
  IssuedWarning,
  ModcpWarningReason,
  WarningDraft,
  WarningFailure,
  WarningPreview,
} from "./warnings-api";

import { ModcpRequestError } from "../modcp/modcp-query";
import { resolveReasonText } from "../report-reasons-query";
import { WarningDuration } from "./warning-format";
import {
  ACCOUNT_STATUS_QUERY_KEY,
  issueWarning,
  previewWarning,
  warningReasonsQueryOptions,
  WARNINGS_QUERY_ROOT,
} from "./warnings-api";

/** The content a warning is about, as a `ContentTarget`. */
export interface WarnContentRef {
  id: string;
  pluginId: string;
  type: string;
}

export interface WarnDialogContentProps {
  content?: null | WarnContentRef;
  onClose: () => void;
  /** Called with the server's result once the warning is issued. */
  onIssued?: (result: IssuedWarning) => void;
  reportId?: null | number;
  userId: number;
}

const NO_REASON = "none";
const EXPIRATION_MODES = ["default", "never", "hours", "at"] as const;

interface FormValues {
  expirationAt?: null | string;
  expirationHours?: number;
  expirationMode?: (typeof EXPIRATION_MODES)[number];
  message?: string;
  overrideNote?: string;
  points?: number;
  reasonId?: string;
  resolveReport?: boolean;
  staffNote?: string;
}

const draftOf = (
  values: FormValues,
  base: Pick<WarningDraft, "content" | "reportId" | "userId">,
  canOverridePoints: boolean,
): WarningDraft => {
  const mode = values.expirationMode ?? "default";

  return {
    ...base,
    expiration:
      mode === "hours"
        ? { hours: values.expirationHours ?? 24, mode }
        : mode === "at" && values.expirationAt
          ? { at: values.expirationAt, mode }
          : mode === "never"
            ? { mode }
            : { mode: "default" },
    points: canOverridePoints ? (values.points ?? null) : null,
    reasonId:
      !values.reasonId || values.reasonId === NO_REASON
        ? null
        : Number(values.reasonId),
  };
};

const failureOfError = (error: Error | null): WarningFailure => {
  if (error instanceof ModcpRequestError) {
    return error.status === 403 ? "forbidden" : "unknown";
  }

  return (error?.message as undefined | WarningFailure) ?? "unknown";
};

const useFailureMessage = () => {
  const t = useTranslations("core.moderation.warn.errors");

  return (failure: WarningFailure) =>
    failure === "unknown" || failure === "conflict" ? t("unknown") : t(failure);
};

const PointsLine = ({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4">
    <dt className="text-muted-foreground">{label}</dt>
    <dd
      className={
        strong ? "text-foreground font-semibold tabular-nums" : "tabular-nums"
      }
    >
      {value}
    </dd>
  </div>
);

/** The sanction a warning leads to, in words. */
export const SanctionSummary = ({
  sanction,
}: {
  sanction: { durationHours?: null | number; endsAt: Date | null | string };
}) => {
  const t = useTranslations("core.moderation.warn");
  const format = useFormatter();
  if (sanction.endsAt === null) return <>{t("sanction.indefinite")}</>;
  const endsAt = format.dateTime(new Date(sanction.endsAt), {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return sanction.durationHours ? (
    <>
      {t("sanction.for")} <WarningDuration hours={sanction.durationHours} />{" "}
      {t("sanction.until", { endsAt })}
    </>
  ) : (
    <>{t("sanction.suspended_until", { endsAt })}</>
  );
};

const Consequences = ({
  base,
  canOverridePoints,
  initial,
}: {
  base: Pick<WarningDraft, "content" | "reportId" | "userId">;
  canOverridePoints: boolean;
  initial: WarningPreview;
}) => {
  const t = useTranslations("core.moderation.warn");
  const { form } = useFormApi();
  const values = useSelector(form.store, state => state.values as FormValues);
  const draft = React.useDeferredValue(
    draftOf(values, base, canOverridePoints),
  );
  const preview = useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await previewWarning(draft);
      if (!result.ok) throw new Error(result.failure);

      return result.data;
    },
    queryKey: [...WARNINGS_QUERY_ROOT, "preview", draft],
    retry: false,
    staleTime: 5_000,
  });
  const data = preview.data ?? initial;
  const failure = useFailureMessage();

  return (
    <section
      aria-busy={preview.isFetching}
      aria-labelledby="warn-consequences-title"
      className="bg-muted/50 flex flex-col gap-3 rounded-xl p-4 text-sm leading-relaxed"
    >
      <h3 className="text-foreground font-medium" id="warn-consequences-title">
        {t("consequences.title")}
      </h3>
      <dl
        className={
          preview.isFetching
            ? "flex flex-col gap-1 opacity-60 motion-safe:transition-opacity"
            : "flex flex-col gap-1 motion-safe:transition-opacity"
        }
      >
        <PointsLine
          label={t("consequences.current")}
          value={data.points.current}
        />
        <PointsLine
          label={t("consequences.warning")}
          value={`+${data.points.warning}`}
        />
        <PointsLine
          label={t("consequences.projected")}
          strong
          value={data.points.projected}
        />
      </dl>
      <p className="text-pretty">
        <span className="font-medium">{t("consequences.action")} </span>
        {data.sanction ? (
          <SanctionSummary sanction={data.sanction} />
        ) : (
          t("consequences.no_action")
        )}
      </p>
      {preview.isError ? (
        <p className="text-destructive" role="alert">
          {failure(preview.error.message as WarningFailure)}
        </p>
      ) : null}
      {data.suspendedUntil ? (
        <p className="text-muted-foreground text-pretty">
          {t("consequences.already_suspended")}
        </p>
      ) : null}
      {data.related.length > 0 ? (
        <p className="text-muted-foreground text-pretty">
          {t("consequences.related", { count: data.related.length })}
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs text-pretty">
        {t("consequences.advisory")}
      </p>
    </section>
  );
};

/**
 * The reason dropdown. Picking a reason resets the points to its default and
 * swaps in its message, unless the moderator already wrote their own.
 */
const ReasonSelect = ({
  labels,
  messageOf,
  reasonOf,
  ...props
}: ItemAutoFormComponentProps & {
  labels: { label: string; value: string }[];
  messageOf: (reason: ModcpWarningReason | undefined) => string;
  reasonOf: (id: string | undefined) => ModcpWarningReason | undefined;
}) => {
  const t = useTranslations("core.moderation.warn");
  const { form } = useFormApi();

  return (
    <AutoFormSelect
      {...props}
      label={t("form.reason")}
      labels={labels}
      onValueChange={value => {
        const values = form.state.values as FormValues;
        const previous = reasonOf(values.reasonId);
        const next = reasonOf(String(value));
        form.setFieldValue("points", next?.points ?? 0);
        if (!values.message || values.message === messageOf(previous)) {
          form.setFieldValue("message", messageOf(next));
        }
      }}
    />
  );
};

const WarnForm = ({
  base,
  initial,
  onClose,
  onIssued,
  reasons,
}: {
  base: Pick<WarningDraft, "content" | "reportId" | "userId">;
  initial: WarningPreview;
  onClose: () => void;
  onIssued?: (result: IssuedWarning) => void;
  reasons: ModcpWarningReason[];
}) => {
  const t = useTranslations("core.moderation.warn");
  const locale = useLocale();
  const format = useFormatter();
  const queryClient = useQueryClient();
  const failure = useFailureMessage();
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());
  const { permissions } = initial;
  const reasonOf = (id: string | undefined) =>
    reasons.find(reason => String(reason.id) === id);
  const messageOf = (reason: ModcpWarningReason | undefined) =>
    reason ? resolveReasonText(reason.message, locale) : "";
  const first = reasons[0];

  const formSchema = z
    .object({
      reasonId: z
        .enum([NO_REASON, ...reasons.map(reason => String(reason.id))])
        .default(first ? String(first.id) : NO_REASON),
      points: z
        .number()
        .int()
        .min(0)
        .max(WARNING_LIMITS.maxPoints)
        .default(first?.points ?? 0),
      expirationMode: z.enum(EXPIRATION_MODES).default("default"),
      expirationHours: z
        .number()
        .int()
        .min(1)
        .max(WARNING_LIMITS.maxDurationHours)
        .default(24),
      expirationAt: z.string().nullable().default(null),
      overrideNote: z
        .string()
        .trim()
        .max(WARNING_LIMITS.noteMaxLength)
        .default(""),
      message: z
        .string()
        .trim()
        .min(WARNING_LIMITS.messageMinLength)
        .max(WARNING_LIMITS.messageMaxLength)
        .default(messageOf(first)),
      staffNote: z
        .string()
        .trim()
        .max(WARNING_LIMITS.noteMaxLength)
        .default(""),
      resolveReport: z.boolean().default(false),
    })
    .superRefine((values, ctx) => {
      const defaultPoints = reasonOf(values.reasonId)?.points ?? 0;
      const overridden =
        (permissions.overridePoints && values.points !== defaultPoints) ||
        values.expirationMode !== "default";
      if (
        overridden &&
        values.overrideNote.length < WARNING_LIMITS.explanationMinLength
      ) {
        ctx.addIssue({
          code: "custom",
          message: t("form.override_note_required"),
          path: ["overrideNote"],
        });
      }
      if (values.expirationMode === "at" && !values.expirationAt) {
        ctx.addIssue({
          code: "custom",
          message: t("form.expiration_at_required"),
          path: ["expirationAt"],
        });
      }
    });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const draft = draftOf(values, base, permissions.overridePoints);
    const result = await issueWarning({
      ...draft,
      idempotencyKey,
      message: values.message,
      overrideNote: values.overrideNote || null,
      resolveReport: values.resolveReport,
      staffNote: values.staffNote || null,
    });
    if (!result.ok) {
      toast.error(t("errors.title"), { description: failure(result.failure) });

      return;
    }

    const { data } = result;
    const summary = t("done.points", {
      after: data.points.after,
      name: initial.user.name,
    });
    const sanction = data.sanction
      ? data.sanction.endsAt
        ? t("done.suspended_until", {
            endsAt: format.dateTime(new Date(data.sanction.endsAt), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })
        : t("done.suspended_indefinitely")
      : null;
    // Someone else warned the member after the form opened.
    const differs =
      !data.duplicate && data.points.before !== initial.points.current;
    toast.success(t("done.title"), {
      description: [
        summary,
        sanction,
        data.reportResolved ? t("done.report_resolved") : null,
        differs ? t("done.differs") : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: WARNINGS_QUERY_ROOT }),
      queryClient.invalidateQueries({ queryKey: ACCOUNT_STATUS_QUERY_KEY }),
      queryClient.invalidateQueries({
        queryKey: ["vitnode", "moderation"],
      }),
    ]);
    onIssued?.(data);
    onClose();
  };

  const reasonLabels = [
    ...reasons.map(reason => ({
      label: `${resolveReasonText(reason.title, locale)} (${t("points", { count: reason.points })})`,
      value: String(reason.id),
    })),
    { label: t("form.no_reason"), value: NO_REASON },
  ];

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          id: "reasonId",
          component: props => (
            <ReasonSelect
              {...props}
              labels={reasonLabels}
              messageOf={messageOf}
              reasonOf={reasonOf}
            />
          ),
        },
        {
          id: "points",
          hidden: () => !permissions.overridePoints,
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("form.points_desc")}
              label={t("form.points")}
            />
          ),
        },
        {
          id: "expirationMode",
          hidden: () => !permissions.overrideExpiration,
          component: props => (
            <AutoFormSelect
              {...props}
              label={t("form.expiration")}
              labels={EXPIRATION_MODES.map(mode => ({
                label: t(`form.expiration_modes.${mode}`),
                value: mode,
              }))}
            />
          ),
        },
        {
          id: "expirationHours",
          hidden: values => values.expirationMode !== "hours",
          component: props => (
            <AutoFormNumber
              {...props}
              label={t("form.expiration_hours")}
              unitLabel={t("form.hours_unit")}
            />
          ),
        },
        {
          id: "expirationAt",
          hidden: values => values.expirationMode !== "at",
          component: props => (
            <AutoFormDateTime {...props} label={t("form.expiration_at")} />
          ),
        },
        {
          id: "overrideNote",
          hidden: values =>
            !(
              (permissions.overridePoints &&
                values.points !== (reasonOf(values.reasonId)?.points ?? 0)) ||
              (values.expirationMode ?? "default") !== "default"
            ),
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("form.override_note_desc")}
              label={t("form.override_note")}
            />
          ),
        },
        {
          id: "message",
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("form.message_desc")}
              label={t("form.message")}
            />
          ),
        },
        {
          id: "staffNote",
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("form.staff_note_desc")}
              label={t("form.staff_note")}
            />
          ),
        },
        {
          id: "resolveReport",
          hidden: () => !base.reportId || !permissions.resolveReport,
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("form.resolve_report_desc")}
              label={t("form.resolve_report")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {base.content || base.reportId ? (
              <Alert icon={<ShieldAlertIcon />} variant="warning">
                <AlertTitle>{t("global.title")}</AlertTitle>
                <AlertDescription className="text-pretty">
                  {t("global.desc")}
                </AlertDescription>
              </Alert>
            ) : null}
            {rendered.reasonId}
            {rendered.points}
            {rendered.expirationMode}
            {rendered.expirationHours}
            {rendered.expirationAt}
            {rendered.overrideNote}
            <Consequences
              base={base}
              canOverridePoints={permissions.overridePoints}
              initial={initial}
            />
            {rendered.message}
            {rendered.staffNote}
            {rendered.resolveReport}
          </div>
          <DialogFooter className="m-0">
            <DialogClose render={<Button variant="ghost" />}>
              {t("cancel")}
            </DialogClose>
            <AutoFormSubmitButton variant="destructive">
              <TriangleAlertIcon aria-hidden="true" />
              {t("submit")}
            </AutoFormSubmitButton>
          </DialogFooter>
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

const DialogSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-5 p-6" role="status">
    <Skeleton className="h-6 w-1/2" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-28 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
);

/**
 * The shared warn form: reason, points, expiry, the message the member reads,
 * a private staff note and a live preview of the consequences. Loads lazily
 * inside `WarnDialog`; every check runs again on the server when it submits.
 */
export const WarnDialogContent = ({
  content = null,
  onClose,
  onIssued,
  reportId = null,
  userId,
}: WarnDialogContentProps) => {
  const t = useTranslations("core.moderation.warn");
  const failure = useFailureMessage();
  const reasons = useQuery(warningReasonsQueryOptions());
  const base = React.useMemo(
    () => ({
      content: content
        ? {
            pluginId: content.pluginId,
            targetId: content.id,
            targetType: content.type,
          }
        : null,
      reportId,
      userId,
    }),
    [content, reportId, userId],
  );
  const first = reasons.data?.[0];
  const initial = useQuery({
    enabled: reasons.isSuccess,
    queryFn: async () => {
      const result = await previewWarning({
        ...base,
        expiration: { mode: "default" },
        reasonId: first?.id ?? null,
      });
      if (!result.ok) throw new Error(result.failure);

      return result.data;
    },
    queryKey: [...WARNINGS_QUERY_ROOT, "initial", base, first?.id ?? null],
    retry: false,
    staleTime: 0,
  });

  if (reasons.isPending || (reasons.isSuccess && initial.isPending)) {
    return (
      <>
        <DialogHeader className="sr-only">
          <DialogTitle>{t("title_loading")}</DialogTitle>
        </DialogHeader>
        <DialogSkeleton />
      </>
    );
  }

  const error = reasons.error ?? initial.error;
  if (error || !initial.data || !reasons.data) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <DialogHeader>
          <DialogTitle className="pe-10 text-balance">
            {t("title_loading")}
          </DialogTitle>
          <DialogDescription className="text-pretty" role="alert">
            {failure(failureOfError(error))}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>
            {t("cancel")}
          </DialogClose>
        </DialogFooter>
      </div>
    );
  }

  return (
    <>
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle className="pe-10 text-balance">
          {t("title", { name: initial.data.user.name })}
        </DialogTitle>
        <DialogDescription className="text-pretty">
          {t("desc")}
          {first ? null : ` ${t("no_reasons")}`}
        </DialogDescription>
      </DialogHeader>
      <WarnForm
        base={base}
        initial={initial.data}
        onClose={onClose}
        onIssued={onIssued}
        reasons={reasons.data}
      />
    </>
  );
};

export default WarnDialogContent;
