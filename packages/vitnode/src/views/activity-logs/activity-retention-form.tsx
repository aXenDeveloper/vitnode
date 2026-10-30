import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AUDIT_RETENTION_DAYS_OPTIONS } from "@/lib/audit/const";

import {
  ACTIVITY_QUERY_ROOT,
  activitySettingsQueryOptions,
  saveActivitySettings,
} from "./activity-query";

const OPTIONS = AUDIT_RETENTION_DAYS_OPTIONS.map(String) as [
  string,
  ...string[],
];

/**
 * The retention form, in the settings sheet. Saving refreshes the cached
 * settings, toasts what will happen next and closes the sheet.
 */
export const ActivityRetentionForm = ({
  canManage,
  onSaved,
}: {
  canManage: boolean;
  onSaved: () => void;
}) => {
  const t = useTranslations("admin.staff.logs.settings");
  const tGlobal = useTranslations("core.global");
  const tError = useTranslations("core.global.errors");
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(activitySettingsQueryOptions());

  const period = (days: number) =>
    days === 0 ? t("forever") : t("days", { count: days });

  const formSchema = z.object({
    retentionDays: z.enum(OPTIONS).default(String(data.retentionDays)),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const retentionDays = Number(values.retentionDays);
    try {
      await saveActivitySettings(retentionDays);
    } catch {
      toast.error(tError("title"), { description: t("error") });

      return;
    }

    await queryClient.invalidateQueries({ queryKey: ACTIVITY_QUERY_ROOT });
    toast.success(t("saved"), {
      description:
        retentionDays === 0
          ? t("saved_forever")
          : t("saved_desc", { period: period(retentionDays) }),
    });
    onSaved();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          component: props => (
            <AutoFormSelect
              {...props}
              description={t("desc")}
              disabled={!canManage}
              label={t("retention")}
              labels={OPTIONS.map(value => ({
                label: period(Number(value)),
                value,
              }))}
            />
          ),
          id: "retentionDays",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
            {rendered.retentionDays}
          </div>
          <AutoFormSheetFooter
            disabled={!canManage}
            submitLabel={tGlobal("save")}
          />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};

export default ActivityRetentionForm;
