import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { formatAiUsd } from "@/lib/ai/format-points";

import type { AdminAiSettingsInput } from "../ai-mutations";
import type { AdminAiSettings } from "../ai-query";

import { fromAiDecimal, toAiDecimal } from "../ai-decimal";

const USD_FORMAT = {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
} as const;

const parseLanguages = (value: string): null | string[] => {
  const codes = [
    ...new Set(
      value
        .split(",")
        .map(code => code.trim())
        .filter(Boolean),
    ),
  ];

  return codes.length > 0 ? codes : null;
};

export interface AiSettingsFormProps {
  canManage: boolean;
  data: AdminAiSettings;
  onSave: (values: AdminAiSettingsInput) => Promise<AdminMutationResult<true>>;
}

export const AiSettingsFormContent = ({
  canManage,
  data,
  onSave,
}: AiSettingsFormProps) => {
  const t = useTranslations("admin.ai.settings");
  const tError = useTranslations("core.global.errors");
  const locale = useLocale();

  const formSchema = z
    .object({
      enabled: z.boolean().default(data.enabled),
      monthlyBudgetUsd: z
        .number()
        .min(0)
        .nullable()
        .default(fromAiDecimal(data.monthlyBudgetUsd)),
      systemMonthlyBudgetUsd: z
        .number()
        .min(0)
        .nullable()
        .default(fromAiDecimal(data.systemMonthlyBudgetUsd)),
      defaultMonthlyPoints: z
        .number()
        .min(0)
        .default(Number(data.defaultMonthlyPoints)),
      userRequestsPerMinute: z
        .number()
        .int()
        .min(1)
        .max(600)
        .default(data.userRequestsPerMinute),
      userConcurrency: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(data.userConcurrency),
      systemConcurrency: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(data.systemConcurrency),
      historyRetentionDays: z
        .number()
        .int()
        .min(7)
        .max(3650)
        .default(data.historyRetentionDays),
      altEnabled: z.boolean().default(data.altEnabled),
      altLanguages: z
        .string()
        .max(500)
        .default(data.altLanguages?.join(", ") ?? ""),
      altBatchSize: z.number().int().min(1).max(100).default(data.altBatchSize),
    })
    .refine(values => !values.altEnabled || values.monthlyBudgetUsd !== null, {
      message: t("alt.needs_budget"),
      path: ["altEnabled"],
    });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onSave({
      altBatchSize: values.altBatchSize,
      altEnabled: values.altEnabled,
      altLanguages: parseLanguages(values.altLanguages),
      defaultMonthlyPoints: toAiDecimal(values.defaultMonthlyPoints),
      enabled: values.enabled,
      historyRetentionDays: values.historyRetentionDays,
      monthlyBudgetUsd:
        values.monthlyBudgetUsd === null
          ? null
          : toAiDecimal(values.monthlyBudgetUsd, 2),
      systemConcurrency: values.systemConcurrency,
      systemMonthlyBudgetUsd:
        values.systemMonthlyBudgetUsd === null
          ? null
          : toAiDecimal(values.systemMonthlyBudgetUsd, 2),
      userConcurrency: values.userConcurrency,
      userRequestsPerMinute: values.userRequestsPerMinute,
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

    toast.success(t("saved.title"), { description: t("saved.desc") });
  };

  return (
    <AutoForm
      fields={[
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("enabled.desc")}
              disabled={!canManage}
              label={t("enabled.label")}
            />
          ),
          id: "enabled",
          tab: "budget",
        },
        {
          component: props => (
            <AutoFormNullableNumber
              {...props}
              description={t("monthly_budget.desc")}
              disabled={!canManage}
              format={USD_FORMAT}
              label={t("monthly_budget.label")}
              min={0}
              orLabel={t("or")}
              step={1}
              toggleLabel={t("no_limit")}
              unitLabel="USD"
            />
          ),
          id: "monthlyBudgetUsd",
          tab: "budget",
        },
        {
          component: props => (
            <AutoFormNullableNumber
              {...props}
              description={t("system_budget.desc")}
              disabled={!canManage}
              format={USD_FORMAT}
              label={t("system_budget.label")}
              min={0}
              orLabel={t("or")}
              step={1}
              toggleLabel={t("no_limit")}
              unitLabel="USD"
            />
          ),
          id: "systemMonthlyBudgetUsd",
          tab: "budget",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("default_points.desc", {
                usd: formatAiUsd(data.pointsConversion.usdPerPoint, locale),
              })}
              disabled={!canManage}
              label={t("default_points.label")}
              min={0}
              step={1}
              unitLabel={t("points_unit")}
            />
          ),
          id: "defaultMonthlyPoints",
          tab: "budget",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("requests_per_minute.desc")}
              disabled={!canManage}
              label={t("requests_per_minute.label")}
              max={600}
              min={1}
              step={1}
            />
          ),
          id: "userRequestsPerMinute",
          tab: "limits",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("user_concurrency.desc")}
              disabled={!canManage}
              label={t("user_concurrency.label")}
              max={20}
              min={1}
              step={1}
            />
          ),
          id: "userConcurrency",
          tab: "limits",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("system_concurrency.desc")}
              disabled={!canManage}
              label={t("system_concurrency.label")}
              max={20}
              min={1}
              step={1}
            />
          ),
          id: "systemConcurrency",
          tab: "limits",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("retention.desc")}
              disabled={!canManage}
              label={t("retention.label")}
              max={3650}
              min={7}
              step={1}
              unitLabel={t("days_unit")}
            />
          ),
          id: "historyRetentionDays",
          tab: "limits",
        },
        {
          children: [
            {
              component: props => (
                <AutoFormInput
                  {...props}
                  description={t("alt.languages.desc")}
                  disabled={!canManage}
                  label={t("alt.languages.label")}
                  placeholder={t("alt.languages.placeholder")}
                />
              ),
              id: "altLanguages",
            },
            {
              component: props => (
                <AutoFormNumber
                  {...props}
                  description={t("alt.batch_size.desc")}
                  disabled={!canManage}
                  label={t("alt.batch_size.label")}
                  max={100}
                  min={1}
                  step={1}
                />
              ),
              id: "altBatchSize",
            },
          ],
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("alt.enabled.desc")}
              disabled={!canManage}
              label={t("alt.enabled.label")}
            />
          ),
          id: "altEnabled",
          tab: "alt",
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t("submit"),
        disabled: !canManage,
      }}
      tabs={[
        { label: t("tabs.budget"), value: "budget" },
        { label: t("tabs.limits"), value: "limits" },
        { label: t("tabs.alt"), value: "alt" },
      ]}
    />
  );
};
