"use client";

import { MailCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useFormSendTestEmail } from "./use-form";

export const ContentSendTestEmail = () => {
  const t = useTranslations("admin.system.integrations.email.test");
  const { onSubmit, formSchema } = useFormSendTestEmail();

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <MailCheckIcon />
        <AlertTitle>{t("info.title")}</AlertTitle>
        <AlertDescription>{t("info.desc")}</AlertDescription>
      </Alert>

      <AutoForm
        fields={[
          {
            id: "to",
            component: props => (
              <AutoFormInput label={t("to.label")} type="email" {...props} />
            ),
          },
          {
            id: "subject",
            component: props => (
              <AutoFormInput label={t("subject.label")} {...props} />
            ),
          },
          {
            id: "content",
            component: props => (
              <AutoFormTextarea
                label={t("content.label")}
                rows={5}
                {...props}
              />
            ),
          },
        ]}
        formSchema={formSchema}
        mode="all"
        onSubmit={onSubmit}
        submitButtonProps={{
          children: t("submit"),
        }}
      />
    </div>
  );
};
