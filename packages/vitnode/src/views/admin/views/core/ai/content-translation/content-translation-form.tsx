import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { AutoFormNullableNumber } from "@/components/form/fields/nullable-number";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { formatAiUsd } from "@/lib/ai/format-points";

import { fromAiDecimal, toAiDecimal } from "../ai-decimal";
import { ADMIN_AI_PERMISSIONS } from "../ai-permissions";
import {
  adminContentTranslationQueryOptions,
  updateAdminContentTranslation,
} from "./content-translation-query";

const USD_FORMAT = {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
} as const;

const isOff = (values: { enabled?: boolean }) => values.enabled === false;

export const ContentTranslationForm = ({
  adminUserId,
  onSaved,
}: {
  adminUserId: AdminIdentity;
  onSaved: () => void;
}) => {
  const t = useTranslations("admin.ai.content_translation");
  const tError = useTranslations("core.global.errors");
  const format = useFormatter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const options = adminContentTranslationQueryOptions({ adminUserId });
  const { data } = useSuspenseQuery(options);
  const canManage = useAdminStaffPermission(ADMIN_AI_PERMISSIONS.manage);
  const codes = data.languages.map(language => language.code);
  const { stats } = data;

  const formSchema = z.object({
    enabled: z.boolean().default(data.enabled),
    locales: z
      .array(z.string())
      .min(1)
      .default(data.locales.filter(code => codes.includes(code))),
    monthlyBudgetUsd: z
      .number()
      .min(0)
      .nullable()
      .default(fromAiDecimal(data.monthlyBudgetUsd)),
    userHourlyLimit: z
      .number()
      .int()
      .min(1)
      .max(10_000)
      .default(data.userHourlyLimit),
    retentionDays: z
      .number()
      .int()
      .min(1)
      .max(3650)
      .default(data.retentionDays),
  });

  const usage = [
    ["usage.spent", formatAiUsd(stats.spentUsd, locale)],
    ["usage.generated", format.number(stats.generated)],
    ["usage.stored", format.number(stats.stored)],
    [
      "usage.latency",
      stats.averageLatencyMs === null
        ? "-"
        : t("usage.seconds", { seconds: stats.averageLatencyMs / 1000 }),
    ],
    ["usage.skipped", format.number(stats.skipped)],
    ["usage.failed", format.number(stats.failed)],
    ["usage.pending", format.number(stats.pending)],
    ["usage.waiting_budget", format.number(stats.waitingBudget)],
  ] as const;

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    formApi,
  ) => {
    const result = await updateAdminContentTranslation({
      enabled: values.enabled,
      locales: values.locales,
      monthlyBudgetUsd:
        values.monthlyBudgetUsd === null
          ? null
          : toAiDecimal(values.monthlyBudgetUsd, 2),
      retentionDays: values.retentionDays,
      userHourlyLimit: values.userHourlyLimit,
    });
    if ("error" in result) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    formApi.reset(formApi.state.values);
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
    toast.success(t("saved.title"), { description: t("saved.desc") });
    onSaved();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={
                data.modelReady ? t("enabled.desc") : t("enabled.no_model")
              }
              disabled={!canManage}
              label={t("enabled.label")}
            />
          ),
          id: "enabled",
        },
        {
          component: props => (
            <AutoFormCombobox
              {...props}
              description={t("locales.desc")}
              disabled={!canManage}
              label={t("locales.label")}
              labels={data.languages.map(language => ({
                label: language.name,
                value: language.code,
              }))}
              multiple
              otherProps={{ ...props.otherProps, enum: codes }}
            />
          ),
          hidden: isOff,
          id: "locales",
        },
        {
          component: props => (
            <AutoFormNullableNumber
              {...props}
              description={t("budget.desc")}
              disabled={!canManage}
              format={USD_FORMAT}
              label={t("budget.label")}
              min={0}
              step={1}
              toggleLabel={t("budget.no_limit")}
              unitLabel="USD"
            />
          ),
          hidden: isOff,
          id: "monthlyBudgetUsd",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("user_limit.desc")}
              disabled={!canManage}
              label={t("user_limit.label")}
              max={10_000}
              min={1}
              step={1}
            />
          ),
          hidden: isOff,
          id: "userHourlyLimit",
        },
        {
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("retention.desc")}
              disabled={!canManage}
              label={t("retention.label")}
              max={3650}
              min={1}
              step={1}
              unitLabel={t("retention.unit")}
            />
          ),
          hidden: isOff,
          id: "retentionDays",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
            <section
              aria-label={t("usage.title")}
              className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4"
            >
              <h3 className="text-sm font-semibold text-balance">
                {t("usage.title")}
              </h3>
              <dl className="grid grid-cols-2 gap-3 text-sm leading-relaxed">
                {usage.map(([label, value]) => (
                  <div className="flex flex-col" key={label}>
                    <dt className="text-muted-foreground">{t(label)}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {Object.entries(rendered).map(([id, field]) => (
              <React.Fragment key={id}>{field}</React.Fragment>
            ))}
          </div>
          <AutoFormSheetFooter
            disabled={!canManage}
            submitLabel={t("submit")}
          />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
