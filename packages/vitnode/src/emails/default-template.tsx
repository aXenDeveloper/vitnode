import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { createTranslator } from 'next-intl';

import type { EnvVariablesVitNode } from '../api/middlewares/global.middleware';

import { CONFIG } from '../lib/config';

type EmailFromMiddlewareType = NonNullable<
  NonNullable<EnvVariablesVitNode['core']['email']>['options']
>;

interface DefaultTemplateEmailProps {
  children: React.ReactNode;
  head?: React.ReactNode;
  logo?: EmailFromMiddlewareType['logo'];
  metadata: EnvVariablesVitNode['core']['metadata'] & {
    url: string;
  };
  previewText?: string;
}

export default function DefaultTemplateEmail({
  previewText,
  head,
  children,
  logo,
  metadata,
}: DefaultTemplateEmailProps) {
  const intl = createTranslator({ messages: {}, locale: 'en' });

  return (
    <Html>
      <Head>{head}</Head>
      {previewText && <Preview>{previewText}</Preview>}
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                background: '#edf2f8',
                primary: '#3160c0',
                foreground: '#0e1216',
                card: '#ffffff',
                border: '#d9dfe4',
              },
            },
          },
        }}
      >
        <Body className="text-foreground bg-background mx-auto px-2 font-sans">
          <Container className="mx-auto max-w-[465px]">
            <Section className="mt-[32px]">
              {logo ? (
                <Img
                  alt={metadata.title}
                  className="mx-auto my-0 max-w-[150px]"
                  src="https://www.reactemailtemplate.com/_next/static/media/reactemailtemplate-logo.b3fb12d9.png"
                />
              ) : (
                <Text className="m-0 text-center text-2xl">
                  {metadata.title}
                </Text>
              )}
            </Section>

            <Section className="bg-card border-border my-[40px] rounded-md border border-solid p-[20px]">
              <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
                Join Us for an Exciting Event!
              </Heading>
              <Text className="text-[14px] leading-[24px] text-black">
                Hello
              </Text>
              <Button
                className="bg-primary px-3 py-2 font-medium leading-4 text-white"
                href="https://example.com"
              >
                {previewText}Click me
              </Button>

              {children}

              <Section className="my-8 text-center text-sm">
                <Link className="text-muted-foreground" href={metadata.url}>
                  {metadata.shortTitle ?? metadata.title} ©{' '}
                  {new Date().getFullYear()}
                </Link>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

DefaultTemplateEmail.PreviewProps = {
  children: 'This is a preview text for the email template.',
  metadata: {
    title: 'VitNode - Email Template',
    shortTitle: 'VitNode',
    url: CONFIG.frontend.href,
  },
  logo: {
    src: 'https://www.reactemailtemplate.com/_next/static/media/reactemailtemplate-logo.b3fb12d9.png',
  },
} satisfies DefaultTemplateEmailProps;
