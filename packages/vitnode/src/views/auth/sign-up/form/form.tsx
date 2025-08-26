"use client";

import { useTranslations } from "next-intl";
import type { z } from "zod";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import {
  AutoForm,
  type ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormInput } from "@/components/form/fields/input";
import { Link } from "@/lib/navigation";
import { removeSpecialCharacters } from "@/lib/special-characters";

import { PasswordInput } from "../components/password-input";
import { useFormSignUp } from "./use-form";

export const FormSignUp = ({
  isEmail,
  captcha,
}: {
  captcha: z.infer<typeof routeMiddlewareSchema>["captcha"];
  isEmail: boolean;
}) => {
  const t = useTranslations("core.auth.sign_up");
  const { onSubmit, formSchema } = useFormSignUp();

  return (
    <AutoForm
      captcha={captcha}
      fields={[
        {
          id: "name",
          component: ({ field, ...props }) => {
            const value: string = field.value ?? "";

            return (
              <div className="space-y-2">
                <AutoFormInput
                  field={field}
                  label={t("username.label")}
                  {...props}
                />
                {value.length >= 3 && (
                  <div className="text-muted-foreground text-sm">
                    {t.rich("username.your_user_code", {
                      code: () => (
                        <span className="text-foreground">
                          {removeSpecialCharacters(value)}
                        </span>
                      ),
                    })}
                  </div>
                )}
              </div>
            );
          },
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
            <PasswordInput label={t("password.label")} {...props} />
          ),
        },
        {
          id: "terms",
          component: props => (
            <AutoFormCheckbox
              {...props}
              description={t.rich("terms.desc", {
                link: text => (
                  <Link className="text-primary" href="/terms">
                    {text}
                  </Link>
                ),
              })}
              label={t("terms.label")}
            />
          ),
        },
        ...(isEmail
          ? [
              {
                id: "newsletter" as const,
                component: (props: ItemAutoFormComponentProps) => (
                  <AutoFormCheckbox
                    {...props}
                    description={t("newsletter.desc")}
                    label={t("newsletter.label")}
                  />
                ),
              },
            ]
          : []),
      ]}
      formSchema={formSchema}
      mode="all"
      onSubmit={onSubmit}
      submitButtonProps={{
        className: "w-full",
        children: t("submit"),
      }}
    />
  );
};
