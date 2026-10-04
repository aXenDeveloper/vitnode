import { Heading, Hr, Link, Section, Text } from "react-email";

import DefaultTemplateEmail, {
  type DefaultTemplateEmailProps,
} from "./default-template";
import { EmailButton } from "./ui/button";

export interface NotificationEmailEntry {
  body?: string;
  title: string;
  /** Absolute URL, already restricted to this site. */
  url: null | string;
}

export interface NotificationEmailProps extends DefaultTemplateEmailProps {
  actionLabel: string;
  entries: NotificationEmailEntry[];
  heading: string;
  intro?: string;
  preferencesLabel: string;
  preferencesUrl: string;
}

/**
 * One template for an immediate email (one entry) and a digest (many). All
 * text arrives as plain strings, so React escapes it - nothing a plugin or an
 * actor wrote can inject markup.
 */
export default function NotificationEmailTemplate({
  actionLabel,
  entries,
  heading,
  intro,
  preferencesLabel,
  preferencesUrl,
  ...props
}: NotificationEmailProps) {
  return (
    <DefaultTemplateEmail {...props}>
      <Section className="bg-card text-card-foreground rounded-lg p-6">
        <Heading as="h1" className="m-0 text-xl">
          {heading}
        </Heading>
        {intro ? <Text className="text-muted-foreground">{intro}</Text> : null}

        {entries.map((entry, index) => (
          // A rendered email is never re-ordered, and titles may repeat.
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <Section key={index}>
            {index > 0 ? <Hr className="border-border" /> : null}
            {entries.length > 1 ? (
              <Text className="m-0 font-semibold">{entry.title}</Text>
            ) : null}
            {entry.body ? (
              <Text className="whitespace-pre-line">{entry.body}</Text>
            ) : null}
            {entry.url ? (
              entries.length === 1 ? (
                <EmailButton href={entry.url}>{actionLabel}</EmailButton>
              ) : (
                <Link className="text-primary text-sm" href={entry.url}>
                  {actionLabel}
                </Link>
              )
            ) : null}
          </Section>
        ))}
      </Section>

      <Text className="text-muted-foreground text-center text-xs">
        <Link className="text-muted-foreground underline" href={preferencesUrl}>
          {preferencesLabel}
        </Link>
      </Text>
    </DefaultTemplateEmail>
  );
}

NotificationEmailTemplate.PreviewProps = {
  ...DefaultTemplateEmail.PreviewProps,
  actionLabel: "View",
  entries: [
    {
      body: "A new article was published in a category you follow.",
      title: "New article: Hello world",
      url: "https://example.com/blog/hello-world",
    },
  ],
  heading: "New article: Hello world",
  preferencesLabel: "Manage notification preferences",
  preferencesUrl: "https://example.com/settings/notifications",
} satisfies NotificationEmailProps;
