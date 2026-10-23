import { Hr, Section, Text } from "react-email";
import { createTranslator } from "use-intl";

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "./default-template";
import {
  EmailCard,
  EmailCardContent,
  EmailCardDescription,
  EmailCardFooter,
  EmailCardHeader,
  EmailCardTitle,
} from "./ui/card";

interface SsoEmailCodeTemplateProps extends DefaultTemplateEmailProps {
  code: string;
  expiryMinutes: number;
  provider: string;
  userIpAddress?: string;
}

SsoEmailCodeTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  code: "482913",
  expiryMinutes: 10,
  provider: "Reddit",
  userIpAddress: "192.168.1.1",
  i18n: {
    ...DefaultTemplateEmail.PreviewProps.i18n,
    messages: {
      core: {
        auth: {
          sso_email_code: {
            email: {
              subject: "Your sign-in code: {code}",
              title: "Confirm your email address",
              intro:
                "Someone signed in with {provider} and asked to use this address. Enter this code on the sign-in page to confirm it's yours:",
              expire_time:
                "The code expires in {minutes, plural, one {# minute} other {# minutes}}.",
              no_action:
                "If you didn't sign in with {provider}, ignore this email - without the code nobody can use your address.",
              security_note:
                "For your security, this request was made from IP address: {ip}",
            },
          },
        },
      },
    },
  },
} satisfies SsoEmailCodeTemplateProps;

/** The one-time code that proves a visitor owns the address they typed after signing in with a provider that shared no verified email. */
export default function SsoEmailCodeTemplate({
  code,
  expiryMinutes,
  i18n,
  provider,
  userIpAddress,
  ...props
}: SsoEmailCodeTemplateProps) {
  const t = createTranslator({
    ...i18n,
    namespace: "core.auth.sso_email_code.email",
  });

  return (
    <DefaultTemplateEmail
      {...props}
      i18n={i18n}
      templateProps={{
        ...props.templateProps,
        previewText: t("subject", { code }),
      }}
    >
      <EmailCard>
        <EmailCardHeader>
          <EmailCardTitle>{t("title")}</EmailCardTitle>
          <EmailCardDescription>
            {t("intro", { provider })}
          </EmailCardDescription>
        </EmailCardHeader>

        <EmailCardContent>
          <Section className="text-center">
            <Text className="m-0 font-mono text-3xl font-bold tracking-[0.3em]">
              {code}
            </Text>
          </Section>

          <Text className="text-muted-foreground mt-6 text-sm leading-relaxed">
            {t("expire_time", { minutes: expiryMinutes })}
          </Text>
        </EmailCardContent>

        <EmailCardFooter>
          <Hr className="border-border my-4 w-full border-t border-solid" />

          <Text className="text-muted-foreground m-0 text-sm leading-relaxed">
            {t("no_action", { provider })}
          </Text>

          {userIpAddress && (
            <Text className="text-muted-foreground mt-4 text-xs">
              {t("security_note", { ip: userIpAddress })}
            </Text>
          )}
        </EmailCardFooter>
      </EmailCard>
    </DefaultTemplateEmail>
  );
}
