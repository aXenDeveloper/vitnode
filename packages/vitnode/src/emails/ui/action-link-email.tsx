import { Hr, Link, Section, Text } from "react-email";
import { createTranslator } from "use-intl";

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "../default-template";
import { EmailButton } from "./button";
import {
  EmailCard,
  EmailCardContent,
  EmailCardDescription,
  EmailCardFooter,
  EmailCardHeader,
  EmailCardTitle,
} from "./card";

export interface ActionLinkEmailProps extends DefaultTemplateEmailProps {
  actionUrl: string;
  expiryDate: Date;
  namespace: "core.auth.reset_password.email" | "core.auth.verify_email.email";
  userIpAddress?: string;
}

export const ActionLinkEmail = ({
  actionUrl,
  expiryDate,
  i18n,
  namespace,
  user,
  userIpAddress,
  ...props
}: ActionLinkEmailProps) => {
  const t = createTranslator({ ...i18n, namespace });

  const userName = user?.name ?? "there";

  return (
    <DefaultTemplateEmail
      i18n={i18n}
      templateProps={{
        ...props.templateProps,
        previewText: t("subject"),
      }}
      user={user}
    >
      <EmailCard>
        <EmailCardHeader>
          <EmailCardTitle>{t("greeting", { name: userName })}</EmailCardTitle>
          <EmailCardDescription>{t("intro")}</EmailCardDescription>
        </EmailCardHeader>

        <EmailCardContent>
          <Section className="text-center">
            <EmailButton className="min-w-[200px]" href={actionUrl} size="lg">
              {t("button")}
            </EmailButton>
          </Section>

          <Text className="text-muted-foreground mt-6 text-sm leading-relaxed">
            {t("instructions")}
          </Text>

          <Text className="text-muted-foreground mt-4 text-sm leading-relaxed">
            {t("expire_time", {
              date: expiryDate.toLocaleString(i18n.locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
              }),
            })}
          </Text>
        </EmailCardContent>

        <EmailCardFooter>
          <Hr className="border-border my-4 w-full border-t border-solid" />

          <Text className="text-muted-foreground m-0 text-sm leading-relaxed">
            {t("no_action")}
          </Text>

          {userIpAddress && (
            <Text className="text-muted-foreground mt-4 text-xs">
              {t("security_note", { ip: userIpAddress })}
            </Text>
          )}
        </EmailCardFooter>
      </EmailCard>

      <Section className="mt-6">
        <Text className="text-muted-foreground text-sm">{t("help")}</Text>
        <Link
          className="text-primary text-sm break-all underline"
          href={actionUrl}
        >
          {actionUrl}
        </Link>
      </Section>
    </DefaultTemplateEmail>
  );
};
