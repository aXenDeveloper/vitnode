import { Hr, Link, Section, Text } from '@react-email/components';
import { createTranslator } from 'use-intl';

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from './default-template';
import { EmailButton } from './ui/button';
import {
  EmailCard,
  EmailCardContent,
  EmailCardDescription,
  EmailCardFooter,
  EmailCardHeader,
  EmailCardTitle,
} from './ui/card';

interface ResetPasswordEmailTemplateProps extends DefaultTemplateEmailProps {
  expiryDate: Date;
  resetUrl: string;
  userIpAddress?: string;
}

ResetPasswordEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  resetUrl: 'https://example.com/reset-password?token=abc123',
  expiryDate: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
  userIpAddress: '192.168.1.1',
  user: {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    language: 'en',
    nameCode: 'john-doe',
  },
  i18n: {
    ...DefaultTemplateEmail.PreviewProps.i18n,
    messages: {
      core: {
        auth: {
          reset_password: {
            email: {
              subject: 'Reset your password',
              greeting: 'Hello {name}!',
              intro:
                'We received a request to reset your password for your account.',
              button: 'Reset Password',
              instructions:
                'Click the button above to reset your password. This link will expire in 30 minutes for security reasons.',
              no_action:
                "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
              security_note:
                'For your security, this request was made from IP address: {ip}',
              help: "If you're having trouble with the button above, copy and paste the URL below into your web browser:",
              expire_time: 'This link will expire on {date}',
            },
          },
        },
      },
    },
  },
} satisfies ResetPasswordEmailTemplateProps;

export default function ResetPasswordEmailTemplate({
  i18n,
  resetUrl,
  expiryDate,
  userIpAddress,
  user,
  ...props
}: ResetPasswordEmailTemplateProps) {
  const t = createTranslator(i18n);

  const userName = user?.name ?? 'there';

  return (
    <DefaultTemplateEmail
      i18n={i18n}
      templateProps={{
        ...props.templateProps,
        previewText: t('core.auth.reset_password.email.subject'),
      }}
      user={user}
    >
      <EmailCard>
        <EmailCardHeader>
          <EmailCardTitle>
            {t('core.auth.reset_password.email.greeting', { name: userName })}
          </EmailCardTitle>
          <EmailCardDescription>
            {t('core.auth.reset_password.email.intro')}
          </EmailCardDescription>
        </EmailCardHeader>

        <EmailCardContent>
          <Section className="text-center">
            <EmailButton className="min-w-[200px]" href={resetUrl} size="lg">
              {t('core.auth.reset_password.email.button')}
            </EmailButton>
          </Section>

          <Text className="text-muted-foreground mt-6 text-sm leading-relaxed">
            {t('core.auth.reset_password.email.instructions')}
          </Text>

          <Text className="text-muted-foreground mt-4 text-sm leading-relaxed">
            {t('core.auth.reset_password.email.expire_time', {
              date: expiryDate.toLocaleString(i18n.locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short',
              }),
            })}
          </Text>
        </EmailCardContent>

        <EmailCardFooter>
          <Hr className="border-border my-4 w-full border-t border-solid" />

          <Text className="text-muted-foreground m-0 text-sm leading-relaxed">
            {t('core.auth.reset_password.email.no_action')}
          </Text>

          {userIpAddress && (
            <Text className="text-muted-foreground mt-4 text-xs">
              {t('core.auth.reset_password.email.security_note', {
                ip: userIpAddress,
              })}
            </Text>
          )}
        </EmailCardFooter>
      </EmailCard>

      {/* Fallback URL section for email clients that don't support buttons */}
      <Section className="mt-6">
        <Text className="text-muted-foreground text-sm">
          {t('core.auth.reset_password.email.help')}
        </Text>
        <Link
          className="text-primary break-all text-sm underline"
          href={resetUrl}
        >
          {resetUrl}
        </Link>
      </Section>
    </DefaultTemplateEmail>
  );
}
