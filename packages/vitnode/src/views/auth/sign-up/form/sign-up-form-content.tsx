"use client";

import type { z } from "zod";

import { useTranslations } from "use-intl";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import {
  AutoForm,
  type ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormInput } from "@/components/form/fields/input";
import { Skeleton } from "@/components/ui/skeleton";
import { removeSpecialCharacters } from "@/lib/special-characters";

import type { AuthLinkComponent } from "../../auth-link";

import { PasswordInput } from "../components/password-input";
import { type SignUpSubmit, useSignUpForm } from "./use-sign-up-form";

export type { SignUpSubmit };

export const SignUpFormContent = ({
  captcha,
  isEmail,
  LinkComponent,
  onSignUp,
  termsHref = "/terms",
}: {
  captcha: z.infer<typeof routeMiddlewareSchema>["captcha"];

  isEmail: boolean;
  LinkComponent: AuthLinkComponent;
  onSignUp: SignUpSubmit;
  termsHref?: string;
}) => {
  const t = useTranslations("core.auth.sign_up");
  const { formSchema, onSubmit } = useSignUpForm({ onSignUp });

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
                  <LinkComponent className="text-primary" href={termsHref}>
                    {text}
                  </LinkComponent>
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

/** The form's shape while the deployment configuration is still in flight. */
export const SignUpFormSkeleton = () => (
  <div className="space-y-8">
    {[0, 1, 2].map(field => (
      <div className="space-y-2" key={field}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
    ))}

    <div className="flex gap-2">
      <Skeleton className="size-4 shrink-0" />
      <Skeleton className="h-4 w-48" />
    </div>

    <Skeleton className="h-9 w-full" />
  </div>
);
