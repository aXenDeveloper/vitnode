import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { NotificationsAdminActions } from "./notifications-mutations";
import type { AdminNotificationSettings } from "./notifications-query";

const NUMBER_FIELDS = [
  { id: "retentionDays", max: 3650, min: 1 },
  { id: "fanoutBatchSize", max: 5000, min: 10 },
  { id: "emailBatchSize", max: 500, min: 1 },
  { id: "emailConcurrency", max: 20, min: 1 },
] as const;

const SettingsReadOnly = ({
  settings,
}: {
  settings: AdminNotificationSettings;
}) => {
  const t = useTranslations("admin.system.notifications.settings");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("read_only")}
      </p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-sm">
            {t("emailEnabled.label")}
          </dt>
          <dd className="font-medium">
            {settings.emailEnabled ? t("enabled") : t("disabled")}
          </dd>
        </div>
        {NUMBER_FIELDS.map(({ id }) => (
          <div className="flex flex-col gap-1" key={id}>
            <dt className="text-muted-foreground text-sm">
              {t(`${id}.label`)}
            </dt>
            <dd className="font-medium tabular-nums">
              {settings[id].toLocaleString()}
              {id === "retentionDays" ? ` ${t("retentionDays.unit")}` : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

const SettingsForm = ({
  onSave,
  settings,
}: {
  onSave: NotificationsAdminActions["updateSettings"];
  settings: AdminNotificationSettings;
}) => {
  const t = useTranslations("admin.system.notifications.settings");
  const tError = useTranslations("core.global.errors");

  const formSchema = z.object({
    emailEnabled: z.boolean().default(settings.emailEnabled),
    retentionDays: z
      .number()
      .int()
      .min(1)
      .max(3650)
      .default(settings.retentionDays),
    fanoutBatchSize: z
      .number()
      .int()
      .min(10)
      .max(5000)
      .default(settings.fanoutBatchSize),
    emailBatchSize: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(settings.emailBatchSize),
    emailConcurrency: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(settings.emailConcurrency),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const mutation = await onSave(values);

    if (mutation.error !== undefined) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("success"), { description: t("success_desc") });
  };

  return (
    <AutoForm
      fields={[
        {
          id: "emailEnabled",
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("emailEnabled.desc")}
              label={t("emailEnabled.label")}
            />
          ),
        },
        ...NUMBER_FIELDS.map(({ id, max, min }) => ({
          id,
          component: (props: ItemAutoFormComponentProps) => (
            <AutoFormNumber
              {...props}
              description={t(`${id}.desc`)}
              label={t(`${id}.label`)}
              max={max}
              min={min}
              step={1}
              unitLabel={
                id === "retentionDays" ? t("retentionDays.unit") : undefined
              }
            />
          ),
        })),
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
    />
  );
};

export const NotificationsSettingsCard = ({
  canEdit,
  onSave,
  settings,
}: {
  canEdit: boolean;
  onSave: NotificationsAdminActions["updateSettings"];
  settings: AdminNotificationSettings;
}) => {
  const t = useTranslations("admin.system.notifications.settings");

  return (
    <Card aria-labelledby="notifications-settings" role="region">
      <CardHeader>
        <CardTitle>
          <h2 className="text-balance" id="notifications-settings">
            {t("title")}
          </h2>
        </CardTitle>
        <CardDescription className="leading-relaxed text-pretty">
          {t("desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canEdit ? (
          <SettingsForm onSave={onSave} settings={settings} />
        ) : (
          <SettingsReadOnly settings={settings} />
        )}
      </CardContent>
    </Card>
  );
};
