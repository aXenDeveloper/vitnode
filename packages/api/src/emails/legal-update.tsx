import { Hr, Link, Section, Text } from "react-email";
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

interface LegalUpdateEmailTemplateProps extends DefaultTemplateEmailProps {
  /** Comparison with the previous version; `null` for a first version. */
  compareUrl: null | string;
  documentType: "privacy" | "terms";
  /** When the version takes effect. */
  effectiveAt: Date;
  /** Stable link to this version's full text. */
  fullTextUrl: string;
  /** Whether the member will have to accept this version to keep using the community. */
  requiresAcceptance: boolean;
  /** The staff-authored summary of changes, plain text with line breaks. */
  summary: string;
  /** The document's title in the email's language. */
  title: string;
  version: number;
}

LegalUpdateEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  compareUrl: "https://example.com/terms/versions/2/changes",
  documentType: "terms",
  effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  fullTextUrl: "https://example.com/terms/versions/2",
  requiresAcceptance: true,
  summary:
    "We clarified how account deletion works.\nWe added a section about AI features.",
  title: "Terms of Service",
  version: 2,
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
        legal: {
          email: {
            subject: "{title} update (version {version})",
            heading: "We're updating our {title}",
            intro: "Version {version} of our {title} takes effect on {date}.",
            summary_title: "What's changing",
            no_summary: "See the full text for the details.",
            action_terms_required:
              "From {date} you'll be asked to accept the new Terms of Service the next time you sign in or use the community.",
            action_informational:
              "You don't need to do anything. Continuing to use the community after {date} means the new version applies to you.",
            full_text: "Read the full text",
            compare: "See what changed",
            retain:
              "Keep this email for your records. Every version stays available at {url}.",
            mandatory:
              "You're receiving this service email because you have an account. It's sent whatever your newsletter or notification settings are.",
          },
        },
      },
    },
  },
} satisfies LegalUpdateEmailTemplateProps;

/**
 * The mandatory announcement of a new Terms of Service or Privacy Policy
 * version. Carries the effective date and the summary of changes in the body,
 * so the recipient keeps them, plus links to the full text and the comparison.
 */
export default function LegalUpdateEmailTemplate({
  compareUrl,
  effectiveAt,
  fullTextUrl,
  i18n,
  requiresAcceptance,
  summary,
  title,
  user,
  version,
  ...props
}: LegalUpdateEmailTemplateProps) {
  const t = createTranslator({ ...i18n, namespace: "core.legal.email" });
  const date = effectiveAt.toLocaleString(i18n.locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  const paragraphs = summary
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);

  return (
    <DefaultTemplateEmail
      i18n={i18n}
      templateProps={{
        ...props.templateProps,
        previewText: t("subject", { title, version }),
      }}
      user={user}
    >
      <EmailCard>
        <EmailCardHeader>
          <EmailCardTitle>{t("heading", { title })}</EmailCardTitle>
          <EmailCardDescription>
            {t("intro", { date, title, version })}
          </EmailCardDescription>
        </EmailCardHeader>

        <EmailCardContent>
          <Text className="m-0 mb-2 text-base font-semibold">
            {t("summary_title")}
          </Text>
          {paragraphs.length > 0 ? (
            paragraphs.map(paragraph => (
              <Text
                className="m-0 mb-2 text-sm leading-relaxed"
                key={paragraph}
              >
                {paragraph}
              </Text>
            ))
          ) : (
            <Text className="m-0 mb-2 text-sm leading-relaxed">
              {t("no_summary")}
            </Text>
          )}

          <Text className="mt-4 text-sm leading-relaxed font-semibold">
            {requiresAcceptance
              ? t("action_terms_required", { date })
              : t("action_informational", { date })}
          </Text>

          <Section className="mt-6 text-center">
            <EmailButton className="min-w-[200px]" href={fullTextUrl} size="lg">
              {t("full_text")}
            </EmailButton>
          </Section>

          {compareUrl ? (
            <Text className="mt-4 text-center text-sm">
              <Link className="text-primary underline" href={compareUrl}>
                {t("compare")}
              </Link>
            </Text>
          ) : null}
        </EmailCardContent>

        <EmailCardFooter>
          <Hr className="border-border my-4 w-full border-t border-solid" />
          <Text className="text-muted-foreground m-0 mb-2 text-sm leading-relaxed">
            {t("retain", { url: fullTextUrl })}
          </Text>
          <Text className="text-muted-foreground m-0 text-sm leading-relaxed">
            {t("mandatory")}
          </Text>
        </EmailCardFooter>
      </EmailCard>
    </DefaultTemplateEmail>
  );
}
