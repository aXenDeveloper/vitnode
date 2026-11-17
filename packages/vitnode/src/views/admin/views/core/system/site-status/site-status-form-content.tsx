import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@vitnode/api/content/rich-text/document";
import { PowerOffIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormEditor } from "@/components/form/fields/editor";
import { AutoFormSwitch } from "@/components/form/fields/switch";

import type {
  AdminSiteStatus,
  AdminSiteStatusInput,
} from "./site-status-query";

/** `turn_off` saves and switches the site off; `edit` saves and keeps the switch as it is. */
export type SiteStatusFormMode = "edit" | "turn_off";

const documentSchema = z.looseObject({
  content: z.array(z.unknown()).optional(),
  type: z.literal("doc"),
});

/** Whether an ISO time has passed. Runs on validation, never during render. */
const isPast = (iso: string): boolean => Date.parse(iso) <= Date.now();

export interface SiteStatusFormProps {
  canManage: boolean;
  data: AdminSiteStatus;
  mode: SiteStatusFormMode;
  onSave: (values: AdminSiteStatusInput) => Promise<AdminMutationResult<true>>;
  onSaved: () => void;
}

export const SiteStatusFormContent = ({
  canManage,
  data,
  mode,
  onSave,
  onSaved,
}: SiteStatusFormProps) => {
  const t = useTranslations("admin.system.site_status.form");
  const tError = useTranslations("core.global.errors");
  const offline = mode === "turn_off" ? true : data.offline;

  const formSchema = z
    .object({
      message: z
        .array(z.object({ languageCode: z.string(), value: documentSchema }))
        .default(
          data.message.map(item => ({
            languageCode: item.languageCode,
            value: { ...item.value },
          })),
        ),
      opensAt: z.string().nullable().default(data.opensAt),
      showCountdown: z.boolean().default(data.showCountdown),
    })
    .superRefine((values, ctx) => {
      if (
        offline &&
        !values.message.some(
          item =>
            isRichTextDocument(item.value) && !isRichTextEmpty(item.value),
        )
      ) {
        ctx.addIssue({
          code: "custom",
          message: t("message.required"),
          path: ["message"],
        });
      }
      if (
        values.opensAt !== null &&
        values.opensAt !== data.opensAt &&
        isPast(values.opensAt)
      ) {
        ctx.addIssue({
          code: "custom",
          message: t("opens_at.past"),
          path: ["opensAt"],
        });
      }
    });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    formApi,
  ) => {
    const result = await onSave({
      message: values.message.flatMap(item =>
        isRichTextDocument(item.value) && !isRichTextEmpty(item.value)
          ? [{ languageCode: item.languageCode, value: item.value }]
          : [],
      ),
      offline,
      opensAt: values.opensAt,
      showCountdown: values.showCountdown,
    });

    if ("error" in result) {
      toast.error(tError("title"), {
        description:
          result.error.status === 400 && result.error.message
            ? result.error.message
            : tError("internal_server_error"),
      });

      return;
    }

    formApi.reset(formApi.state.values);
    toast.success(
      mode === "turn_off" ? t("turned_off.title") : t("saved.title"),
      {
        description:
          mode === "turn_off" ? t("turned_off.desc") : t("saved.desc"),
      },
    );
    onSaved();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          component: props => (
            <AutoFormEditor
              {...props}
              className="min-h-40"
              description={t("message.desc")}
              format="json"
              label={t("message.label")}
              multiLang
              placeholder={t("message.placeholder")}
            />
          ),
          id: "message",
        },
        {
          component: props => (
            <AutoFormDateTime
              {...props}
              description={t("opens_at.desc")}
              disabled={!canManage}
              label={t("opens_at.label")}
            />
          ),
          id: "opensAt",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("show_countdown.desc")}
              disabled={!canManage}
              label={t("show_countdown.label")}
            />
          ),
          hidden: values => !values.opensAt,
          id: "showCountdown",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
            {rendered.message}
            {rendered.opensAt}
            {rendered.showCountdown}
          </div>
          <AutoFormSheetFooter
            allowPristine={mode === "turn_off"}
            disabled={!canManage}
            submitIcon={
              mode === "turn_off" ? (
                <PowerOffIcon aria-hidden="true" />
              ) : (
                <SaveIcon aria-hidden="true" />
              )
            }
            submitLabel={
              mode === "turn_off" ? t("submit_turn_off") : t("submit")
            }
          />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
