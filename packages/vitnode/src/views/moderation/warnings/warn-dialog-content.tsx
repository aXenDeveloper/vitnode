import { useSelector } from "@tanstack/react-form";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { ContentTarget } from "@/content/target";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormEditor } from "@/components/form/fields/editor";
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
import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@/content/rich-text/document";
import { richTextToPlainText } from "@/content/rich-text/plain-text";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";

import type { DocumentDraft, MessageDraft } from "./warn-dialog-parts";
import type {
  IssuedWarning,
  ModcpWarningReason,
  WarningDraft,
  WarningFailure,
  WarningPreview,
} from "./warnings-api";

import { ModcpRequestError } from "../modcp/modcp-query";
import {
  filledMessage,
  MemberPanel,
  messageText,
  NO_REASON,
  OutcomeSummary,
  reasonMessage,
  ReasonPicker,
  Reveal,
} from "./warn-dialog-parts";
import {
  issueWarning,
  previewWarning,
  warningReasonsQueryOptions,
  WARNINGS_QUERY_ROOT,
} from "./warnings-api";

interface WarnDialogContentProps {
  content?: ContentTarget | null;
  onClose: () => void;
  /** Called with the server's result once the warning is issued. */
  onIssued?: (result: IssuedWarning) => void;
  reportId?: null | number;
  userId: number;
}

const EXPIRATION_MODES = ["default", "never", "hours", "at"] as const;

interface FormValues {
  expirationAt?: null | string;
  expirationHours?: number;
  expirationMode?: (typeof EXPIRATION_MODES)[number];
  message?: MessageDraft;
  overrideNote?: string;
  points?: number;
  reasonId?: string;
  resolveReport?: boolean;
  staffNote?: DocumentDraft | null;
}

type WarnBase = Pick<WarningDraft, "content" | "reportId" | "userId">;

const documentSchema = z
  .looseObject({
    content: z.array(z.unknown()).optional(),
    type: z.literal("doc"),
  })
  .nullable();

const draftOf = (
  values: FormValues,
  base: WarnBase,
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

class WarningFailureError extends Error {
  constructor(failure: WarningFailure) {
    super(failure);
    this.failure = failure;
  }

  readonly failure: WarningFailure;
}

const failureOfError = (error: Error | null): WarningFailure => {
  if (error instanceof WarningFailureError) return error.failure;
  if (error instanceof ModcpRequestError && error.status === 403) {
    return "forbidden";
  }

  return "unknown";
};

const useFailureMessage = () => {
  const t = useTranslations("core.moderation.warn.errors");

  return (failure: WarningFailure) =>
    failure === "unknown" || failure === "conflict" ? t("unknown") : t(failure);
};

const LiveOutcome = ({
  base,
  canOverridePoints,
  initial,
}: {
  base: WarnBase;
  canOverridePoints: boolean;
  initial: WarningPreview;
}) => {
  const { form } = useFormApi();
  const values = useSelector(form.store, state => state.values as FormValues);
  const draft = React.useDeferredValue(
    draftOf(values, base, canOverridePoints),
  );
  const preview = useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await previewWarning(draft);
      if (!result.ok) throw new WarningFailureError(result.failure);

      return result.data;
    },
    queryKey: [...WARNINGS_QUERY_ROOT, "preview", draft],
    retry: false,
    staleTime: 5_000,
  });
  const failure = useFailureMessage();

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <OutcomeSummary
        isFetching={preview.isFetching}
        preview={preview.data ?? initial}
      />
      {preview.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {failure(failureOfError(preview.error))}
        </p>
      ) : null}
    </div>
  );
};

const WarnForm = ({
  base,
  initial,
  onClose,
  onIssued,
  reasons,
}: {
  base: WarnBase;
  initial: WarningPreview;
  onClose: () => void;
  onIssued?: (result: IssuedWarning) => void;
  reasons: ModcpWarningReason[];
}) => {
  const t = useTranslations("core.moderation.warn");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const failure = useFailureMessage();
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());
  const [messageRevision, setMessageRevision] = React.useState(0);
  const { permissions } = initial;
  const reasonOf = (id: string | undefined) =>
    reasons.find(reason => String(reason.id) === id);
  const first = reasons[0];
  const templates = new Set(
    reasons.map(reason => messageText(reasonMessage(reason))),
  );
  const isOverridden = (values: FormValues) =>
    (permissions.overridePoints &&
      values.points !== (reasonOf(values.reasonId)?.points ?? 0)) ||
    (values.expirationMode ?? "default") !== "default";

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
        .array(z.object({ languageCode: z.string(), value: documentSchema }))
        .default(reasonMessage(first))
        .superRefine((message, ctx) => {
          const filled = filledMessage(message);
          if (filled.length === 0) {
            ctx.addIssue({
              code: "custom",
              message: t("form.message_required"),
            });

            return;
          }
          const outOfRange = filled.some(item => {
            const length = richTextToPlainText(item.value).length;

            return (
              length < WARNING_LIMITS.messageMinLength ||
              length > WARNING_LIMITS.messageMaxLength
            );
          });
          if (outOfRange) {
            ctx.addIssue({
              code: "custom",
              message: t("form.message_length", {
                max: WARNING_LIMITS.messageMaxLength,
                min: WARNING_LIMITS.messageMinLength,
              }),
            });
          }
        }),
      staffNote: documentSchema
        .default(null)
        .refine(
          note =>
            !isRichTextDocument(note) ||
            richTextToPlainText(note).length <= WARNING_LIMITS.noteMaxLength,
          {
            message: t("form.staff_note_length", {
              max: WARNING_LIMITS.noteMaxLength,
            }),
          },
        ),
      resolveReport: z.boolean().default(false),
    })
    .superRefine((values, ctx) => {
      if (
        isOverridden(values) &&
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
      message: filledMessage(values.message),
      overrideNote: values.overrideNote || null,
      resolveReport: values.resolveReport,
      staffNote:
        isRichTextDocument(values.staffNote) &&
        !isRichTextEmpty(values.staffNote)
          ? values.staffNote
          : null,
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
    await queryClient.invalidateQueries({
      queryKey: ["vitnode", "moderation"],
    });
    onIssued?.(data);
    onClose();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          id: "reasonId",
          component: props => (
            <ReasonPickerField
              {...props}
              label={t("form.reason")}
              onTemplateSwap={() => {
                setMessageRevision(revision => revision + 1);
              }}
              reasons={reasons}
              templates={templates}
            />
          ),
        },
        {
          id: "points",
          hidden: () => !permissions.overridePoints,
          component: props => (
            <AutoFormNumber
              {...props}
              label={t("form.points")}
              max={WARNING_LIMITS.maxPoints}
              min={0}
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
          component: props => (
            <AutoFormNumber
              {...props}
              label={t("form.expiration_hours")}
              max={WARNING_LIMITS.maxDurationHours}
              min={1}
              unitLabel={t("form.hours_unit")}
            />
          ),
        },
        {
          id: "expirationAt",
          component: props => (
            <AutoFormDateTime {...props} label={t("form.expiration_at")} />
          ),
        },
        {
          id: "overrideNote",
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
            <AutoFormEditor
              key={messageRevision}
              {...props}
              className="min-h-32"
              collapsed
              description={t("form.message_desc")}
              format="json"
              label={t("form.message")}
              multiLang
              placeholder={t("form.message_placeholder")}
            />
          ),
        },
        {
          id: "staffNote",
          component: props => (
            <AutoFormEditor
              {...props}
              className="min-h-24"
              collapsed
              description={t("form.staff_note_desc")}
              format="json"
              label={t("form.staff_note")}
              placeholder={t("form.staff_note_placeholder")}
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
          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[17rem_minmax(0,1fr)]">
            <MemberPanel preview={initial} />
            <div className="flex min-w-0 flex-col gap-5 p-6">
              <DialogHeader>
                <DialogTitle className="pe-10 text-balance">
                  {t("title", { name: initial.user.name })}
                </DialogTitle>
                <DialogDescription className="text-pretty">
                  {t("desc")}
                  {first ? null : ` ${t("no_reasons")}`}
                </DialogDescription>
              </DialogHeader>
              {base.content || base.reportId ? (
                <Alert icon={<ShieldAlertIcon />} variant="warning">
                  <AlertTitle>{t("global.title")}</AlertTitle>
                  <AlertDescription className="text-pretty">
                    {t("global.desc")}
                  </AlertDescription>
                </Alert>
              ) : null}
              {rendered.reasonId}
              {permissions.overridePoints || permissions.overrideExpiration ? (
                <div className="flex flex-col">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {rendered.points}
                    {rendered.expirationMode}
                  </div>
                  <RevealWhen
                    when={values => values.expirationMode === "hours"}
                  >
                    {rendered.expirationHours}
                  </RevealWhen>
                  <RevealWhen when={values => values.expirationMode === "at"}>
                    {rendered.expirationAt}
                  </RevealWhen>
                  <RevealWhen when={isOverridden}>
                    {rendered.overrideNote}
                  </RevealWhen>
                </div>
              ) : null}
              {rendered.message}
              {rendered.staffNote}
              {rendered.resolveReport}
            </div>
          </div>
          <DialogFooter className="m-0 items-stretch gap-4 sm:items-center sm:justify-between">
            <LiveOutcome
              base={base}
              canOverridePoints={permissions.overridePoints}
              initial={initial}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose render={<Button variant="ghost" />}>
                {t("cancel")}
              </DialogClose>
              <AutoFormSubmitButton variant="destructive">
                <TriangleAlertIcon aria-hidden="true" />
                {t("submit")}
              </AutoFormSubmitButton>
            </div>
          </DialogFooter>
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

const RevealWhen = ({
  children,
  when,
}: {
  children: React.ReactNode;
  when: (values: FormValues) => boolean;
}) => {
  const { form } = useFormApi();
  const open = useSelector(form.store, state =>
    when(state.values as FormValues),
  );

  return <Reveal open={open}>{children}</Reveal>;
};

const ReasonPickerField = ({
  onTemplateSwap,
  templates,
  ...props
}: Omit<React.ComponentProps<typeof ReasonPicker>, "onReason"> & {
  onTemplateSwap: () => void;
  templates: Set<string>;
}) => {
  const { form } = useFormApi();

  return (
    <ReasonPicker
      {...props}
      onReason={reason => {
        const { message } = form.state.values as FormValues;
        const current = messageText(message);
        form.setFieldValue("points", reason?.points ?? 0);
        if (current === "" || templates.has(current)) {
          form.setFieldValue("message", reasonMessage(reason));
          onTemplateSwap();
        }
      }}
    />
  );
};

const DialogSkeleton = () => (
  <div
    aria-busy="true"
    className="grid md:grid-cols-[17rem_minmax(0,1fr)]"
    role="status"
  >
    <div className="bg-muted/50 flex flex-col gap-6 border-b p-6 md:border-e md:border-b-0">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-16 w-full" />
    </div>
    <div className="flex flex-col gap-5 p-6">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

/**
 * The shared warn form: who the member is and their recent warnings, the
 * reason, points, expiry, the rich-text message the member reads (one per
 * language), a private rich-text staff note and a live preview of the
 * consequences. Loads lazily inside `WarnDialog`; every check runs again on
 * the server when it submits.
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
      if (!result.ok) throw new WarningFailureError(result.failure);

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
    <WarnForm
      base={base}
      initial={initial.data}
      onClose={onClose}
      onIssued={onIssued}
      reasons={reasons.data}
    />
  );
};

export default WarnDialogContent;
