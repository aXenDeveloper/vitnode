import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  type TailwindConfig,
  Text,
} from "react-email";

import type { EmailModelSendArgs } from "@/api/models/email";

import { CONFIG } from "../lib/config";

DefaultTemplateEmail.PreviewProps = {
  children: "This is a preview text for the email template.",
  templateProps: {
    metadata: {
      title: "VitNode - Email Template",
      shortTitle: "VitNode",
      url: CONFIG.web.href,
    },
    logo: {
      // Resolved against the configured web origin rather than hardcoded. It
      // was `http://localhost:3000`, which was the app that served the asset at
      // the time; an install that configures its own origin was never served by
      // a literal either.
      src: new URL("/logo_vitnode_dark.png", CONFIG.web).href,
    },
  },
  i18n: {
    messages: {},
    locale: "en",
  },
} satisfies DefaultTemplateEmailProps & { children: React.ReactNode };

/**
 * What `c.get("email").send()` passes to an email's `content`, and what
 * {@link DefaultTemplateEmail} reads. Spread them into the template unchanged.
 */
export interface DefaultTemplateEmailProps extends Pick<
  EmailModelSendArgs,
  "user"
> {
  /** The recipient's locale and its messages, for translating the email. */
  i18n: {
    locale: string;
    // oxlint-disable-next-line typescript/no-explicit-any
    messages: Record<string, any>;
  };
  templateProps: {
    /** Extra elements for the email's `<head>`. */
    head?: React.ReactNode;
    /** The header logo, from the API config's `email.logo`. Without `src`, `text` (or the site title) is shown as text. */
    logo?: {
      src?: string;
      text?: string;
    };
    /** The site's title and URL, used in the header and the footer link. */
    metadata: {
      shortTitle?: string;
      title: string;
      url: string;
    };
    /** The inbox preview line shown after the subject. */
    previewText?: string;
    /** Extends the template's Tailwind config; `theme.extend.colors` overrides the built-in color tokens. */
    tailwindConfig?: TailwindConfig;
  };
}

/**
 * VitNode's standard email layout: the site logo (or title), your content, and
 * a footer linking to the site. It wraps everything in react-email's
 * `<Tailwind>` with the color tokens (`bg-primary`, `text-muted-foreground`...)
 * that `EmailButton` and `EmailCard` use. Rendered on the server by
 * `c.get("email")`.
 *
 * @example
 * ```tsx
 * import DefaultTemplateEmail, {
 *   type DefaultTemplateEmailProps,
 * } from "@vitnode/core/emails/default-template";
 *
 * export const WelcomeEmail = (props: DefaultTemplateEmailProps) => (
 *   <DefaultTemplateEmail {...props}>Welcome!</DefaultTemplateEmail>
 * );
 *
 * await c.get("email").send({ user, subject: "Welcome", content: props => <WelcomeEmail {...props} /> });
 * ```
 */
export default function DefaultTemplateEmail({
  children,
  i18n: { locale },
  templateProps: { logo, metadata, previewText, head, tailwindConfig },
}: DefaultTemplateEmailProps & { children: React.ReactNode }) {
  return (
    <Html lang={locale}>
      <Head>{head}</Head>
      {previewText && <Preview>{previewText}</Preview>}
      <Tailwind
        config={{
          ...tailwindConfig,
          theme: {
            ...tailwindConfig?.theme,
            extend: {
              ...tailwindConfig?.theme?.extend,
              colors: {
                background: "#edf2f8",
                foreground: "#0e1216",
                card: "#ffffff",
                "card-foreground": "#171b1f",
                popover: "#ffffff",
                "popover-foreground": "#171b1f",
                primary: "#3160c0",
                "primary-foreground": "#fafafa",
                secondary: "#f4f9ff",
                "secondary-foreground": "#1e2226",
                muted: "#eaeff5",
                "muted-foreground": "#686c72",
                accent: "#e0e5eb",
                "accent-foreground": "#1e2226",
                destructive: "#de3b3f",
                warn: "#906600",
                border: "#d9dfe4",
                input: "#d9dfe4",
                ring: "#5aa3ec",
                ...tailwindConfig?.theme?.extend?.colors,
              },
            },
          },
        }}
      >
        <Body className="text-foreground bg-background mx-auto px-2 font-sans">
          <Container className="mx-auto max-w-116.25">
            <Section className="my-8">
              {logo?.src ? (
                <Img
                  alt={logo.text ?? metadata.title}
                  className="mx-auto my-0 max-w-37.5"
                  src={logo.src}
                />
              ) : (
                <Text className="m-0 text-center text-2xl">
                  {logo?.text ?? metadata.title}
                </Text>
              )}
            </Section>

            {children}

            <Section className="my-8 text-center text-sm">
              <Link className="text-muted-foreground" href={metadata.url}>
                {metadata.shortTitle ?? metadata.title} ©{" "}
                {/* oxlint-disable-next-line @eslint-react/purity */}
                {new Date().getFullYear()}
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
