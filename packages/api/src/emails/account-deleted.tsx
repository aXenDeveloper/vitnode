import { Text } from "react-email";
import { createTranslator } from "use-intl";

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "./default-template";
import {
  EmailCard,
  EmailCardContent,
  EmailCardDescription,
  EmailCardHeader,
  EmailCardTitle,
} from "./ui/card";

interface AccountDeletedEmailTemplateProps extends DefaultTemplateEmailProps {
  /** The member's display name, read before the account row was deleted. */
  name: string;
}

AccountDeletedEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  name: "John Doe",
  i18n: {
    ...DefaultTemplateEmail.PreviewProps.i18n,
    messages: {
      core: {
        auth: {
          account_deletion: {
            email: {
              deleted: {
                subject: "Your account has been deleted",
                greeting: "Goodbye, {name}",
                intro:
                  "Your account and the personal data tied to it have been deleted, as you asked.",
                details:
                  "Posts other members replied to may stay on the site, no longer linked to you. Records the law makes us keep, such as invoices, are kept only for as long as required.",
                outro:
                  "Thanks for being part of the community. You're always welcome back with a new account.",
              },
            },
          },
        },
      },
    },
  },
} satisfies AccountDeletedEmailTemplateProps;

/** Sent to the address an account had, once the account has been erased. */
export default function AccountDeletedEmailTemplate({
  i18n,
  name,
  ...props
}: AccountDeletedEmailTemplateProps) {
  const t = createTranslator({
    ...i18n,
    namespace: "core.auth.account_deletion.email.deleted",
  });

  return (
    <DefaultTemplateEmail
      i18n={i18n}
      templateProps={{ ...props.templateProps, previewText: t("subject") }}
    >
      <EmailCard>
        <EmailCardHeader>
          <EmailCardTitle>{t("greeting", { name })}</EmailCardTitle>
          <EmailCardDescription>{t("intro")}</EmailCardDescription>
        </EmailCardHeader>
        <EmailCardContent>
          <Text className="text-muted-foreground text-sm leading-relaxed">
            {t("details")}
          </Text>
          <Text className="text-muted-foreground mt-4 text-sm leading-relaxed">
            {t("outro")}
          </Text>
        </EmailCardContent>
      </EmailCard>
    </DefaultTemplateEmail>
  );
}
