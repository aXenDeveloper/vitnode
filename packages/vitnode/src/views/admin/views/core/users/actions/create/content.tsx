"use client";

import { useTranslations } from "next-intl";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";

import { useFormCreateUserAdmin } from "./use-form";

export const ContentCreateUserAdmin = () => {
  const t = useTranslations("admin.user.create");
  const { onSubmit, formSchema } = useFormCreateUserAdmin();

  return (
    <AutoForm
      fields={[
        {
          id: "name",
          component: props => (
            <AutoFormInput label={t("name.label")} {...props} />
          ),
        },
        {
          id: "email",
          component: props => (
            <AutoFormInput label={t("email.label")} {...props} />
          ),
        },
        {
          id: "password",
          component: props => (
            <AutoFormInput
              label={t("password.label")}
              type="password"
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
  );
};
