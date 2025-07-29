/* eslint-disable @typescript-eslint/dot-notation */
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
} from '@react-email/components';

import { CONFIG } from '../lib/config';

export interface DefaultTemplateEmailProps {
  locale: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: Record<string, any>;
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
  locale,
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
                ...tailwindConfig?.theme?.extend?.colors,
                background:
                  tailwindConfig?.theme?.extend?.colors?.['background'] ??
                  '#edf2f8',
                foreground:
                  tailwindConfig?.theme?.extend?.colors?.['foreground'] ??
                  '#0e1216',
                card:
                  tailwindConfig?.theme?.extend?.colors?.['card'] ?? '#ffffff',
                'card-foreground':
                  tailwindConfig?.theme?.extend?.colors?.['card-foreground'] ??
                  '#171b1f',
                popover:
                  tailwindConfig?.theme?.extend?.colors?.['popover'] ??
                  '#ffffff',
                'popover-foreground':
                  tailwindConfig?.theme?.extend?.colors?.[
                    'popover-foreground'
                  ] ?? '#171b1f',
                primary:
                  tailwindConfig?.theme?.extend?.colors?.['primary'] ??
                  '#3160c0',
                'primary-foreground':
                  tailwindConfig?.theme?.extend?.colors?.[
                    'primary-foreground'
                  ] ?? '#fafafa',
                secondary:
                  tailwindConfig?.theme?.extend?.colors?.['secondary'] ??
                  '#e2ecf9',
                'secondary-foreground':
                  tailwindConfig?.theme?.extend?.colors?.[
                    'secondary-foreground'
                  ] ?? '#1e2226',
                muted:
                  tailwindConfig?.theme?.extend?.colors?.['muted'] ?? '#eaeff5',
                'muted-foreground':
                  tailwindConfig?.theme?.extend?.colors?.['muted-foreground'] ??
                  '#373b40',
                accent:
                  tailwindConfig?.theme?.extend?.colors?.['accent'] ??
                  '#e0e5eb',
                'accent-foreground':
                  tailwindConfig?.theme?.extend?.colors?.[
                    'accent-foreground'
                  ] ?? '#1e2226',
                destructive:
                  tailwindConfig?.theme?.extend?.colors?.['destructive'] ??
                  '#de3b3f',
                warn:
                  tailwindConfig?.theme?.extend?.colors?.['warn'] ?? '#906600',
                border:
                  tailwindConfig?.theme?.extend?.colors?.['border'] ??
                  '#d9dfe4',
                input:
                  tailwindConfig?.theme?.extend?.colors?.['input'] ?? '#d9dfe4',
                ring:
                  tailwindConfig?.theme?.extend?.colors?.['ring'] ?? '#5aa3ec',
              },
            },
          },
        }}
      >
        <Body className="text-foreground bg-background mx-auto px-2 font-sans">
          <Container className="mx-auto max-w-[465px]">
            <Section className="my-8">
              {logo?.src ? (
                <Img
                  alt={logo.text ?? metadata.title}
                  className="mx-auto my-0 max-w-[150px]"
                  src={logo.src}
                />
              ) : (
                <Text className="m-0 text-center text-2xl">
                  {logo?.text ?? metadata.title}
                </Text>
              )}
            </Section>

            <Section className="border-border bg-card rounded-xl border border-solid p-[20px]">
              {children}
            </Section>

            <Section className="my-8 text-center text-sm">
              <Link className="text-muted-foreground" href={metadata.url}>
                {metadata.shortTitle ?? metadata.title} ©{' '}
                {new Date().getFullYear()}
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

DefaultTemplateEmail.PreviewProps = {
  children: 'This is a preview text for the email template.',
  templateProps: {
    metadata: {
      title: 'VitNode - Email Template',
      shortTitle: 'VitNode',
      url: CONFIG.web.href,
    },
    logo: {
      src: 'http://localhost:3000/logo_vitnode_dark.png',
    },
  },
  messages: {},
  locale: 'en',
} satisfies DefaultTemplateEmailProps & { children: React.ReactNode };
