"use client";

import { MailCheckIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { SendTestEmail } from "./send-test-email-mutation";

import { useFormSendTestEmail } from "./use-form";

export const ContentSendTestEmail = ({ onSend }: { onSend: SendTestEmail }) => {
  const t = useTranslations("admin.system.integrations.email.test");
  const { onSubmit, formSchema } = useFormSendTestEmail(onSend);

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
