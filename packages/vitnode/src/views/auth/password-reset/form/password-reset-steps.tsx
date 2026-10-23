import type z from "zod";

import { ArrowLeftIcon, MailCheckIcon, MailIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { routeMiddlewareSchema } from "@/api/modules/middleware/route";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Button } from "@/components/ui/button";
import { InputGroupAddon } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

import type {
  PasswordReset,
  PasswordResetSubmitValues,
} from "./use-password-reset-form";

import { AuthStep } from "../../auth-step";
import { readRememberedEmail } from "../../remembered-email";
import { createPasswordResetFormSchema } from "./schema";

type Captcha = z.infer<typeof routeMiddlewareSchema>["captcha"];

const BackButton = ({ onBack }: { onBack: () => void }) => {
  const t = useTranslations("core.auth.reset_password");

  return (
    <Button
      className="self-start"
      onClick={onBack}
      onMouseDown={event => {
        event.preventDefault();
      }}
      size="sm"
      type="button"
      variant="ghost"
    >
      <ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
      {t("back")}
    </Button>
  );
};

const PasswordResetRequestStep = ({
  captcha,
  onBack,
  onSend,
}: {
  captcha?: Captcha;
  onBack: () => void;
  onSend: (values: PasswordResetSubmitValues) => Promise<void>;
}) => {
  const t = useTranslations("core.auth.reset_password");
  const formSchema = createPasswordResetFormSchema(
    { invalidEmail: t("address.invalid") },
    { defaultEmail: readRememberedEmail() },
  );

  return (
    <>
      <BackButton onBack={onBack} />

      <div className="flex flex-col gap-2">
        <h2 className="text-lg leading-tight font-semibold text-balance">
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </div>

      <AutoForm
        captcha={captcha}
        fields={[
          {
            id: "email",
            component: props => (
              <AutoFormInput
                {...props}
                autoComplete="email"
                autoFocus
                inputMode="email"
                label={t("address.label")}
              >
                <InputGroupAddon>
                  <MailIcon />
                </InputGroupAddon>
              </AutoFormInput>
            ),
          },
        ]}
        formSchema={formSchema}
        onSubmit={async ({ email }, _form, { captchaToken }) => {
          await onSend({ captchaToken, email });
        }}
        submitButtonProps={{
          className: "w-full",
          children: t("submit"),
        }}
      />
    </>
  );
};

const PasswordResetSentStep = ({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) => {
  const t = useTranslations("core.auth.reset_password");

  return (
    <>
      <BackButton onBack={onBack} />

      <div className="flex flex-col gap-3" role="status">
        <span
          aria-hidden
          className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full"
        >
          <MailCheckIcon className="size-5" />
        </span>
        <h2 className="text-lg leading-tight font-semibold text-balance">
          {t("confirmation.title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("confirmation.desc")}{" "}
          <strong className="text-foreground font-medium break-words">
            {email}
          </strong>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("confirmation.check_spam")}
        </p>
      </div>
    </>
  );
};

export const PasswordResetSteps = ({
  captcha,
  reset,
}: {
  captcha?: Captcha;
  reset: PasswordReset;
}) =>
  reset.step.kind === "sent" ? (
    <AuthStep key="reset-sent">
      <PasswordResetSentStep email={reset.step.email} onBack={reset.back} />
    </AuthStep>
  ) : (
    <AuthStep key="reset-form">
      <PasswordResetRequestStep
        captcha={captcha}
        onBack={reset.back}
        onSend={reset.send}
      />
    </AuthStep>
  );

export const PasswordResetTrigger = ({
  children,
  isSending,
  onClick,
}: {
  children: React.ReactNode;
  isSending: boolean;
  onClick: () => void;
}) => (
  <button
    aria-busy={isSending}
    className="text-primary inline-flex cursor-pointer items-center gap-1.5 hover:underline disabled:cursor-default disabled:opacity-60"
    disabled={isSending}
    onClick={onClick}
    onMouseDown={event => {
      event.preventDefault();
    }}
    type="button"
  >
    {isSending ? <Spinner aria-hidden className="size-3.5" /> : null}
    {children}
  </button>
);
