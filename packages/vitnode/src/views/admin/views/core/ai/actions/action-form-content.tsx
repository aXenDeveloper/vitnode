import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AI_ACTION_LIMITS } from "@/api/lib/ai/action";
import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";

import type { AdminAiActionInput } from "../ai-mutations";
import type { AdminAiAction, AdminAiModel } from "../ai-query";

const AI_DEFAULT_MODEL = "__default__";

type LimitField = Exclude<
  keyof typeof AI_ACTION_LIMITS,
  "dailyLimit" | "maxImages"
>;

export interface AiActionFormProps {
  action: AdminAiAction;
  models: AdminAiModel[];
  onSave: (body: AdminAiActionInput) => Promise<AdminMutationResult<true>>;
}

const LIMIT_FIELDS = [
  "dailyLimit",
  "maxInputCharacters",
  "maxOutputTokens",
  "maxRetries",
  "maxSteps",
  "timeoutMs",
] as const;

export const AiActionFormContent = ({
  action,
  models,
  onSave,
  onSaved,
}: AiActionFormProps & { onSaved?: () => void }) => {
  const t = useTranslations("admin.ai.actions.form");
  const tError = useTranslations("core.global.errors");
  const limitsHeadingId = React.useId();
  const { defaults, settings } = action;

  const modelIds = [
    ...new Set(
      [
        settings.modelId,
        settings.fallbackModelId,
        ...action.compatibleModelIds,
      ].filter((id): id is string => id !== null),
    ),
  ];
  const modelOptions = [AI_DEFAULT_MODEL, ...modelIds] as [string, ...string[]];
  const modelLabels = [
    { label: t("model_default"), value: AI_DEFAULT_MODEL },
    ...modelIds.map(id => ({
      label: models.find(model => model.id === id)?.name ?? id,
      value: id,
    })),
  ];

  const limit = (field: "dailyLimit" | LimitField) =>
    z
      .number()
      .int()
      .min(AI_ACTION_LIMITS[field].min)
      .max(AI_ACTION_LIMITS[field].max)
      .nullable()
      .default(settings[field]);

  const formSchema = z.object({
    enabled: z.boolean().default(settings.enabled),
    modelId: z.enum(modelOptions).default(settings.modelId ?? AI_DEFAULT_MODEL),
    fallbackModelId: z
      .enum(modelOptions)
      .default(settings.fallbackModelId ?? AI_DEFAULT_MODEL),
    dailyLimit: limit("dailyLimit"),
    maxInputCharacters: limit("maxInputCharacters"),
    maxOutputTokens: limit("maxOutputTokens"),
    maxRetries: limit("maxRetries"),
    maxSteps: limit("maxSteps"),
    timeoutMs: limit("timeoutMs"),
    instructions: z
      .string()
      .max(2_000)
      .default(settings.instructions ?? ""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const model = (value: string) =>
      value === AI_DEFAULT_MODEL ? null : value;
    const result = await onSave({
      dailyLimit: values.dailyLimit,
      enabled: values.enabled,
      fallbackModelId: model(values.fallbackModelId),
      instructions: values.instructions.trim() || null,
      key: action.key,
      maxInputCharacters: values.maxInputCharacters,
      maxOutputTokens: values.maxOutputTokens,
      maxRetries: values.maxRetries,
      maxSteps: values.maxSteps,
      modelId: model(values.modelId),
      timeoutMs: values.timeoutMs,
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

    toast.success(t("saved.title"), {
      description: t("saved.desc", { title: action.title }),
    });
    onSaved?.();
  };

  const limitField =
    (label: string, fallback: null | number, unit?: string) =>
    (props: ItemAutoFormComponentProps) => (
      <AutoFormNullableNumber
        {...props}
        label={label}
        min={0}
        orLabel={t("or")}
        step={1}
        toggleLabel={
          fallback === null
            ? t("use_default_none")
            : t("use_default", { value: fallback })
        }
        unitLabel={unit}
      />
    );

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("enabled_desc")}
              label={t("enabled")}
            />
          ),
          id: "enabled",
        },
        {
          component: props => (
            <AutoFormSelect
              {...props}
              description={t("model_desc")}
              label={t("model")}
              labels={modelLabels}
            />
          ),
          id: "modelId",
        },
        {
          component: props => (
            <AutoFormSelect
              {...props}
              description={t("fallback_desc")}
              label={t("fallback")}
              labels={modelLabels}
            />
          ),
          id: "fallbackModelId",
        },
        {
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("instructions_desc")}
              label={t("instructions")}
            />
          ),
          id: "instructions",
        },
        {
          component: limitField(t("daily_limit"), defaults.dailyLimit),
          id: "dailyLimit",
        },
        {
          component: limitField(
            t("max_input_characters"),
            defaults.maxInputCharacters,
          ),
          id: "maxInputCharacters",
        },
        {
          component: limitField(
            t("max_output_tokens"),
            defaults.maxOutputTokens,
          ),
          id: "maxOutputTokens",
        },
        {
          component: limitField(t("max_retries"), defaults.maxRetries),
          id: "maxRetries",
        },
        {
          component: limitField(t("max_steps"), defaults.maxSteps),
          id: "maxSteps",
        },
        {
          component: limitField(t("timeout"), defaults.timeoutMs, "ms"),
          id: "timeoutMs",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-5">
            <div className="flex flex-col gap-5">
              {rendered.enabled}
              {rendered.modelId}
              {rendered.fallbackModelId}
              {rendered.instructions}
            </div>
            <section
              aria-labelledby={limitsHeadingId}
              className="flex flex-col gap-5 border-t pt-6"
            >
              <div className="flex flex-col gap-1">
                <h3
                  className="text-base font-semibold text-balance"
                  id={limitsHeadingId}
                >
                  {t("limits.title")}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {t("limits.desc")}
                </p>
              </div>
              {LIMIT_FIELDS.map(id => (
                <React.Fragment key={id}>{rendered[id]}</React.Fragment>
              ))}
            </section>
          </div>
          <AutoFormSheetFooter submitLabel={t("submit")} />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
