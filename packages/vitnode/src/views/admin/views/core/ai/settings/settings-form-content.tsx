import { useSelector } from "@tanstack/react-form";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { Button } from "@/components/ui/button";
import { useFormApi } from "@/components/ui/form";
import { SheetClose } from "@/components/ui/sheet";
import { formatAiUsd } from "@/lib/ai/format-points";

import type { AdminAiSettingsInput } from "../ai-mutations";
import type { AdminAiSettings } from "../ai-query";

import { fromAiDecimal, toAiDecimal } from "../ai-decimal";

const USD_FORMAT = {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
} as const;

const SECTIONS = [
  {
    fields: [
      "monthlyBudgetUsd",
      "systemMonthlyBudgetUsd",
      "defaultMonthlyPoints",
    ],
    key: "budget",
  },
  {
    fields: [
      "userRequestsPerMinute",
      "userConcurrency",
      "systemConcurrency",
      "historyRetentionDays",
    ],
    key: "limits",
  },
  { fields: ["altEnabled"], key: "alt" },
] as const;

const isAiOff = (values: { enabled?: boolean }) => values.enabled === false;

export interface AiSettingsFormProps {
  canManage: boolean;
  data: AdminAiSettings;
  onSave: (values: AdminAiSettingsInput) => Promise<AdminMutationResult<true>>;
}

const AiSettingsFormFooter = ({ canManage }: { canManage: boolean }) => {
  const t = useTranslations("admin.ai.settings");
  const tGlobal = useTranslations("core.global");
  const { form } = useFormApi();
  const isDirty = useSelector(form.store, state => !state.isDefaultValue);
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  return (
    <div className="bg-popover flex items-center justify-between gap-3 border-t p-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {isDirty ? t("unsaved") : null}
      </p>
      <div className="flex items-center gap-2">
        <SheetClose
          render={<Button variant="ghost">{tGlobal("cancel")}</Button>}
        />
        <Button
          disabled={!canManage || !isDirty}
          isLoading={isSubmitting}
          type="submit"
        >
          {t("submit")}
        </Button>
      </div>
    </div>
  );
};

export const AiSettingsFormContent = ({
  canManage,
  data,
  onSave,
}: AiSettingsFormProps) => {
  const t = useTranslations("admin.ai.settings");
  const tError = useTranslations("core.global.errors");
  const locale = useLocale();
  const headingId = React.useId();

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
      altBatchSize: z.number().int().min(1).max(100).default(data.altBatchSize),
    })
    .refine(values => !values.altEnabled || values.monthlyBudgetUsd !== null, {
      message: t("alt.needs_budget"),
      path: ["altEnabled"],
    });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    formApi,
  ) => {
    const result = await onSave({
      altBatchSize: values.altBatchSize,
      altEnabled: values.altEnabled,
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

    formApi.reset(formApi.state.values);
    toast.success(t("saved.title"), { description: t("saved.desc") });
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
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
          hidden: isAiOff,
          id: "monthlyBudgetUsd",
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
          hidden: isAiOff,
          id: "systemMonthlyBudgetUsd",
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
          hidden: isAiOff,
          id: "defaultMonthlyPoints",
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
          hidden: isAiOff,
          id: "userRequestsPerMinute",
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
          hidden: isAiOff,
          id: "userConcurrency",
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
          hidden: isAiOff,
          id: "systemConcurrency",
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
          hidden: isAiOff,
          id: "historyRetentionDays",
        },
        {
          children: [
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
          hidden: isAiOff,
          id: "altEnabled",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-5">
            {rendered.enabled}
            {SECTIONS.filter(section =>
              section.fields.some(id => id in rendered),
            ).map(section => (
              <section
                aria-labelledby={`${headingId}-${section.key}`}
                className="flex flex-col gap-5 border-t pt-6"
                key={section.key}
              >
                <div className="flex flex-col gap-1">
                  <h3
                    className="text-base font-semibold text-balance"
                    id={`${headingId}-${section.key}`}
                  >
                    {t(`sections.${section.key}`)}
                  </h3>
                  {section.key === "budget" ? (
                    <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                      {t("time_zone", { timeZone: data.timeZone })}
                    </p>
                  ) : null}
                </div>
                {section.fields.map(id => (
                  <React.Fragment key={id}>{rendered[id]}</React.Fragment>
                ))}
              </section>
            ))}
          </div>
          <AiSettingsFormFooter canManage={canManage} />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
