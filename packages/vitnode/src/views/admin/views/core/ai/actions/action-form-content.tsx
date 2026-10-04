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
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { useDialog } from "@/components/ui/dialog";

import type { AdminAiActionInput } from "../ai-mutations";
import type { AdminAiAction, AdminAiModel } from "../ai-query";

/** The select's spelling of `null`: the action's own default model. */
export const AI_DEFAULT_MODEL = "__default__";

type LimitField = Exclude<
  keyof typeof AI_ACTION_LIMITS,
  "dailyLimit" | "maxImages"
>;

export interface AiActionFormProps {
  action: AdminAiAction;
  models: AdminAiModel[];
  onSave: (body: AdminAiActionInput) => Promise<AdminMutationResult<true>>;
}

export const AiActionFormContent = ({
  action,
  models,
  onSave,
}: AiActionFormProps) => {
  const t = useTranslations("admin.ai.actions.form");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();
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
      description: t("saved.desc", { key: action.key }),
    });
    setIsDirty?.(false);
    setOpen?.(false);
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
          tab: "general",
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
          tab: "general",
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
          tab: "general",
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
          tab: "general",
        },
        {
          component: limitField(t("daily_limit"), defaults.dailyLimit),
          id: "dailyLimit",
          tab: "limits",
        },
        {
          component: limitField(
            t("max_input_characters"),
            defaults.maxInputCharacters,
          ),
          id: "maxInputCharacters",
          tab: "limits",
        },
        {
          component: limitField(
            t("max_output_tokens"),
            defaults.maxOutputTokens,
          ),
          id: "maxOutputTokens",
          tab: "limits",
        },
        {
          component: limitField(t("max_retries"), defaults.maxRetries),
          id: "maxRetries",
          tab: "limits",
        },
        {
          component: limitField(t("max_steps"), defaults.maxSteps),
          id: "maxSteps",
          tab: "limits",
        },
        {
          component: limitField(t("timeout"), defaults.timeoutMs, "ms"),
          id: "timeoutMs",
          tab: "limits",
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
      tabs={[
        { label: t("tabs.general"), value: "general" },
        { label: t("tabs.limits"), value: "limits" },
      ]}
    />
  );
};
