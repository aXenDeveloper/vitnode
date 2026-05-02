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
} from "@react-email/components";

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
      src: "http://localhost:3000/logo_vitnode_dark.png",
    },
  },
  i18n: {
    messages: {},
    locale: "en",
  },
} satisfies DefaultTemplateEmailProps & { children: React.ReactNode };

export interface DefaultTemplateEmailProps extends Pick<
  EmailModelSendArgs,
  "user"
> {
  i18n: {
    locale: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: Record<string, any>;
  };
  templateProps: {
    head?: React.ReactNode;
    logo?: {
      src?: string;
      text?: string;
    };
    metadata: {
      shortTitle?: string;
      title: string;
      url: string;
    };
    previewText?: string;
    tailwindConfig?: TailwindConfig;
  };
}

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
                {/* eslint-disable-next-line @eslint-react/purity */}
                {new Date().getFullYear()}
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
