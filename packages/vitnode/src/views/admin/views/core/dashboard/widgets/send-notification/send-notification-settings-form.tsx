"use client";

import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";

import { useWidgetSettingsDialog } from "../../grid/widget-settings-dialog";

export const SendNotificationSettingsForm = ({
  defaultTitle,
}: {
  defaultTitle: string;
}) => {
  const t = useTranslations("admin.dashboard.widgets.send-notification");
  const tCore = useTranslations("core.global");
  const { save } = useWidgetSettingsDialog();

  const formSchema = z.object({
    defaultTitle: z
      .string()
      .trim()
      .max(255)
      .default(defaultTitle)
      .describe(t("settings.message_desc")),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    await save({ defaultTitle: values.defaultTitle });
  };

  return (
    <AutoForm
      fields={[
        {
          id: "defaultTitle",
          component: props => (
            <AutoFormInput
              autoFocus
              label={t("settings.message")}
              placeholder={t("default_message")}
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      mode="all"
      onSubmit={onSubmit}
      submitButtonProps={{
        ["aria-label"]: tCore("save"),
        children: tCore("save"),
      }}
    />
  );
};
