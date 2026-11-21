import { Hr, Section, Text } from "react-email";
import { createTranslator } from "use-intl";

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "./default-template";
import { EmailButton } from "./ui/button";
import {
  EmailCard,
  EmailCardContent,
  EmailCardDescription,
  EmailCardFooter,
  EmailCardHeader,
  EmailCardTitle,
} from "./ui/card";

interface AccountDeletionScheduledEmailTemplateProps extends DefaultTemplateEmailProps {
  /** `true` when staff scheduled the deletion rather than the member. */
  byAdmin?: boolean;
  /** Where the member cancels: the privacy settings page. */
  cancelUrl: string;
  /** The member's display name, for the greeting. */
  name: string;
  /** When the account will be erased. */
  scheduledAt: Date;
}

AccountDeletionScheduledEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  cancelUrl: "https://example.com/settings/privacy",
  name: "John Doe",
  scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  user: {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    language: "en",
    nameCode: "john-doe",
  },
  i18n: {
    ...DefaultTemplateEmail.PreviewProps.i18n,
    messages: {
      core: {
        auth: {
          account_deletion: {
            email: {
              scheduled: {
                subject: "Your account is scheduled for deletion",
                greeting: "Hello {name}!",
                intro:
                  "We received a request to delete your account. It will be deleted for good on {date}.",
                button: "Keep my account",
                instructions:
                  "Changed your mind? Sign in before that date and confirm that you want to keep your account. Until then you're signed out everywhere, and signing in always asks you to cancel the deletion first.",
                no_action:
                  "If you didn't ask for this, sign in and cancel the deletion right away, then change your password.",
                admin_note: "An administrator scheduled this deletion.",
              },
            },
          },
        },
      },
    },
  },
} satisfies AccountDeletionScheduledEmailTemplateProps;

/** Confirms a deletion request and tells the member how to cancel it. */
export default function AccountDeletionScheduledEmailTemplate({
  byAdmin,
  cancelUrl,
  i18n,
  name,
  scheduledAt,
  user,
  ...props
}: AccountDeletionScheduledEmailTemplateProps) {
  const t = createTranslator({
    ...i18n,
    namespace: "core.auth.account_deletion.email.scheduled",
  });
  const date = scheduledAt.toLocaleString(i18n.locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <DefaultTemplateEmail
      i18n={i18n}
      templateProps={{ ...props.templateProps, previewText: t("subject") }}
      user={user}
    >
      <EmailCard>
        <EmailCardHeader>
          <EmailCardTitle>{t("greeting", { name })}</EmailCardTitle>
          <EmailCardDescription>{t("intro", { date })}</EmailCardDescription>
        </EmailCardHeader>

        <EmailCardContent>
          <Section className="text-center">
            <EmailButton className="min-w-[200px]" href={cancelUrl} size="lg">
              {t("button")}
            </EmailButton>
          </Section>

          <Text className="text-muted-foreground mt-6 text-sm leading-relaxed">
            {t("instructions")}
          </Text>
        </EmailCardContent>

        <EmailCardFooter>
          <Hr className="border-border my-4 w-full border-t border-solid" />
          <Text className="text-muted-foreground m-0 text-sm leading-relaxed">
            {byAdmin ? t("admin_note") : t("no_action")}
          </Text>
        </EmailCardFooter>
      </EmailCard>
    </DefaultTemplateEmail>
  );
}
