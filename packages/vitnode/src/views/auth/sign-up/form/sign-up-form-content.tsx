import type { routeMiddlewareSchema } from "@vitnode/api/modules/middleware/middleware.schema";
import type { z } from "zod";

import { Link } from "@tanstack/react-router";
import { removeSpecialCharacters } from "@vitnode/api/lib/special-characters";
import { MailIcon, UserIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import {
  AutoForm,
  type ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormInput } from "@/components/form/fields/input";
import { InputGroupAddon } from "@/components/ui/input-group";

import { PasswordInput } from "../components/password-input";
import {
  type SignUpSubmit,
  type SignUpTerms,
  useSignUpForm,
} from "./use-sign-up-form";

export type { SignUpSubmit, SignUpTerms };

export const SignUpFormContent = ({
  captcha,
  isEmail,
  onSignUp,
  onTermsChanged,
  privacy,
  terms,
  termsHref = "/terms",
}: {
  captcha: z.infer<typeof routeMiddlewareSchema>["captcha"];

  isEmail: boolean;
  onSignUp: SignUpSubmit;
  /** Reloads the effective Terms after the API said they changed. */
  onTermsChanged?: () => Promise<void> | void;
  /** The published Privacy Policy, linked prominently under the form. */
  privacy?: null | { title: string };
  /**
   * The effective Terms of Service version. While set, the form links its
   * full text, requires an unticked box to be ticked and sends this exact
   * version with the sign-up.
   */
  terms?: null | SignUpTerms;
  termsHref?: string;
}) => {
  const t = useTranslations("core.auth.sign_up");
  const tLegal = useTranslations("core.legal.sign_up");
  const { formSchema, onSubmit } = useSignUpForm({
    onSignUp,
    onTermsChanged,
    terms,
  });
  const legalLink = (href: string) => (text: React.ReactNode) => (
    <Link
      className="text-primary underline-offset-4 hover:underline"
      rel="noopener"
      target="_blank"
      to={href}
    >
      {text}
    </Link>
  );

  return (
    <AutoForm
      canSubmitWhenInvalid
      captcha={captcha}
      fields={[
        {
          id: "name",
          component: ({ field, ...props }) => {
            const value: string = field.value ?? "";

            return (
              <div className="space-y-2">
                <AutoFormInput
                  autoComplete="nickname"
                  field={field}
                  label={t("username.label")}
                  {...props}
                >
                  <InputGroupAddon>
                    <UserIcon />
                  </InputGroupAddon>
                </AutoFormInput>
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
            <AutoFormInput
              autoComplete="email"
              inputMode="email"
              label={t("email.label")}
              {...props}
            >
              <InputGroupAddon>
                <MailIcon />
              </InputGroupAddon>
            </AutoFormInput>
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
          component: props =>
            terms ? (
              <div className="flex flex-col gap-3">
                <AutoFormCheckbox
                  {...props}
                  label={tLegal.rich("terms", {
                    link: legalLink(`/terms/versions/${terms.version}`),
                    title: terms.title,
                    version: terms.version,
                  })}
                />
                {privacy ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {tLegal.rich("privacy", {
                      link: legalLink("/privacy"),
                      title: privacy.title,
                    })}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <AutoFormCheckbox
                  {...props}
                  description={t.rich("terms.desc", {
                    link: text => (
                      <Link className="text-primary" to={termsHref}>
                        {text}
                      </Link>
                    ),
                  })}
                  label={t("terms.label")}
                />
                {privacy ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {tLegal.rich("privacy", {
                      link: legalLink("/privacy"),
                      title: privacy.title,
                    })}
                  </p>
                ) : null}
              </div>
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
