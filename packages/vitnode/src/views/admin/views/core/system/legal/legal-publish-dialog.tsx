import type { LegalDocumentType } from "@vitnode/api/lib/legal/contract";

import { MegaphoneIcon, SendIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLegalDate } from "@/views/legal/legal-format";

import type {
  AdminLegalDraft,
  AdminLegalDraftContext,
} from "./legal-admin-query";

import { publishAdminLegalDraft } from "./legal-admin-query";

const isFuture = (iso: null | string): boolean =>
  iso !== null && Date.parse(iso) > Date.now();

const nowIso = (): string => new Date().toISOString();

const PROBLEM_KEYS = {
  body_missing: "problems.body_missing",
  summary_missing: "problems.summary_missing",
  title_missing: "problems.title_missing",
} as const;

const isProblemKey = (value: string): value is keyof typeof PROBLEM_KEYS =>
  value in PROBLEM_KEYS;

/**
 * Announces the saved draft. Shows what still blocks it, asks when it takes
 * effect and requires the operator's publication checklist: the notice
 * period and wording their installation must give, and the mandatory email.
 */
export const LegalPublishDialog = ({
  context,
  disabled,
  documentType,
  draft,
  onPublished,
}: {
  context: AdminLegalDraftContext;
  /** While the form has unsaved changes. */
  disabled: boolean;
  documentType: LegalDocumentType;
  draft: AdminLegalDraft;
  onPublished: () => Promise<void>;
}) => {
  const t = useTranslations("admin.system.legal.publish");
  const formatDate = useLegalDate();
  const [open, setOpen] = React.useState(false);
  const requiresAcceptance =
    documentType === "terms" &&
    (context.acceptanceForced || draft.requiresAcceptance);
  const blocked =
    context.problems.length > 0 ||
    context.upcoming !== null ||
    !context.emailConfigured;

  const formSchema = z
    .object({
      when: z
        .enum(["now", "later"])
        .default(draft.effectiveAt ? "later" : "now"),
      effectiveAt: z.string().nullable().default(draft.effectiveAt),
      checklistConfirmed: z
        .boolean()
        .refine(value => value, t("checklist.confirm"))
        .default(false),
    })
    .superRefine((values, ctx) => {
      if (values.when === "later" && !isFuture(values.effectiveAt)) {
        ctx.addIssue({
          code: "custom",
          message: t("effective_at.desc"),
          path: ["effectiveAt"],
        });
      }
    });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await publishAdminLegalDraft(documentType, {
      effectiveAt:
        values.when === "later" && values.effectiveAt
          ? new Date(values.effectiveAt).toISOString()
          : nowIso(),
      requiresAcceptance,
      revision: draft.revision,
    });
    if (!result.ok) {
      const key =
        result.code === "LEGAL_EMAIL_ADAPTER_MISSING"
          ? "email_missing"
          : result.code === "LEGAL_UPCOMING_VERSION_EXISTS"
            ? "upcoming"
            : "error";
      toast.error(t(`toast.${key}.title`), {
        description: t(`toast.${key}.desc`),
      });

      return;
    }

    toast.success(
      t("toast.published.title", { version: result.data.version }),
      {
        description: t("toast.published.desc"),
      },
    );
    setOpen(false);
    await onPublished();
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button disabled={disabled} variant="outline" />}>
        <MegaphoneIcon aria-hidden="true" />
        {t("button")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("title", { version: context.nextVersion })}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {t("desc")}
          </DialogDescription>
        </DialogHeader>

        {context.problems.length > 0 ? (
          <Alert variant="warning">
            <AlertTitle>{t("problems.title")}</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc">
                {context.problems.filter(isProblemKey).map(problem => (
                  <li key={problem}>{t(PROBLEM_KEYS[problem])}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {context.upcoming ? (
          <Alert variant="warning">
            <AlertDescription>
              {t("upcoming_exists", {
                date: formatDate(context.upcoming.effectiveAt),
                version: context.upcoming.version,
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        {context.emailConfigured ? null : (
          <Alert variant="warning">
            <AlertTitle>{t("toast.email_missing.title")}</AlertTitle>
            <AlertDescription>{t("toast.email_missing.desc")}</AlertDescription>
          </Alert>
        )}

        {blocked ? null : (
          <React.Suspense
            fallback={
              <div aria-busy="true" className="flex flex-col gap-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            }
          >
            <AutoForm
              className="flex flex-col gap-4"
              fields={[
                {
                  id: "when",
                  component: props => (
                    <AutoFormRadioGroup
                      {...props}
                      label={t("effective_at.label")}
                      labels={[
                        { label: t("now"), value: "now" },
                        { label: t("later"), value: "later" },
                      ]}
                    />
                  ),
                },
                {
                  id: "effectiveAt",
                  hidden: values => values.when !== "later",
                  component: props => (
                    <AutoFormDateTime
                      {...props}
                      description={t("effective_at.desc")}
                      label={t("effective_at.label")}
                    />
                  ),
                },
                {
                  id: "checklistConfirmed",
                  component: props => (
                    <div className="flex flex-col gap-3 rounded-xl border p-4">
                      <p className="font-medium">{t("checklist.title")}</p>
                      <ul className="text-muted-foreground list-inside list-disc text-sm leading-relaxed">
                        <li>{t("checklist.notice_period")}</li>
                        <li>{t("checklist.wording")}</li>
                        <li>{t("checklist.email")}</li>
                        <li>
                          {requiresAcceptance
                            ? t("acceptance_note")
                            : t("informational_note")}
                        </li>
                      </ul>
                      <AutoFormCheckbox
                        {...props}
                        label={t("checklist.confirm")}
                      />
                    </div>
                  ),
                },
              ]}
              formSchema={formSchema}
              onSubmit={onSubmit}
              submitButtonProps={{
                children: (
                  <>
                    <SendIcon aria-hidden="true" />
                    {t("submit", { version: context.nextVersion })}
                  </>
                ),
              }}
            />
          </React.Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
};
