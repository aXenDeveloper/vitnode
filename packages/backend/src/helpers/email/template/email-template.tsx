import { convertColor, getHSLFromString } from '@/functions';
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
  Text,
} from '@react-email/components';
import React from 'react';

import { getTranslationForEmail } from '../email';
import { GetHelpersForEmailType } from '../email-helpers.type';

export interface EmailTemplateProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  helpers: GetHelpersForEmailType;
  previewText?: string;
  user: {
    language: string;
    name: string;
  };
}

export const EmailTemplate = ({
  previewText,
  children = 'This is the email template.',
  helpers: {
    frontend_url,
    site_name,
    site_short_name,
    backend_url,
    logo,
    color_primary,
    color_primary_foreground,
  },
  user,
}: EmailTemplateProps) => {
  const primaryHSL = getHSLFromString(color_primary);
  const primaryForegroundHSL = getHSLFromString(color_primary_foreground);
  const t = getTranslationForEmail('admin.core.email', user.language);

  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                primary: {
                  DEFAULT: `#${primaryHSL ? convertColor.hslToHex(primaryHSL) : '215fdc'}`,
                  foreground: `#${
                    primaryForegroundHSL
                      ? convertColor.hslToHex(primaryForegroundHSL)
                      : '131415'
                  }`,
                },
                foreground: '#131415',
                card: '#fff',
                border: '#e0e4eb',
                muted: {
                  DEFAULT: '#f1f3f9',
                  foreground: '#676d79',
                },
              },
            },
            fontSize: {
              xs: ['12px', { lineHeight: '16px' }],
              sm: ['14px', { lineHeight: '20px' }],
              base: ['16px', { lineHeight: '24px' }],
              lg: ['18px', { lineHeight: '28px' }],
              xl: ['20px', { lineHeight: '28px' }],
              '2xl': ['24px', { lineHeight: '32px' }],
              '3xl': ['30px', { lineHeight: '36px' }],
              '4xl': ['36px', { lineHeight: '36px' }],
              '5xl': ['48px', { lineHeight: '1' }],
              '6xl': ['60px', { lineHeight: '1' }],
              '7xl': ['72px', { lineHeight: '1' }],
              '8xl': ['96px', { lineHeight: '1' }],
              '9xl': ['144px', { lineHeight: '1' }],
            },
            spacing: {
              px: '1px',
              0: '0',
              0.5: '2px',
              1: '4px',
              1.5: '6px',
              2: '8px',
              2.5: '10px',
              3: '12px',
              3.5: '14px',
              4: '16px',
              5: '20px',
              6: '24px',
              7: '28px',
              8: '32px',
              9: '36px',
              10: '40px',
              11: '44px',
              12: '48px',
              14: '56px',
              16: '64px',
              20: '80px',
              24: '96px',
              28: '112px',
              32: '128px',
              36: '144px',
              40: '160px',
              44: '176px',
              48: '192px',
              52: '208px',
              56: '224px',
              60: '240px',
              64: '256px',
              72: '288px',
              80: '320px',
              96: '384px',
            },
          },
        }}
      >
        <Body className="text-foreground mx-auto px-2 font-sans">
          <Container className="max-w-[600px]">
            <Section className="my-8 text-xl">
              {logo ? (
                <Img
                  alt={site_name}
                  className="max-w-[200px]"
                  src={`${backend_url}/public/${logo.dir_folder}/${logo.file_name}`}
                />
              ) : (
                site_name
              )}
            </Section>

            <Section className="border-border bg-card rounded border border-solid p-5">
              <Text className="mt-0">
                {t('hello')}{' '}
                <span className="text-primary font-bold">{user.name}</span>,
              </Text>
              {typeof children === 'string' ? (
                <Text className="text-[14px] leading-[24px] text-black">
                  {children}
                </Text>
              ) : (
                children
              )}
            </Section>

            <Section className="my-8 text-center text-sm">
              <Link className="text-muted-foreground" href={frontend_url}>
                {site_short_name} © {new Date().getFullYear()}
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailTemplate;
