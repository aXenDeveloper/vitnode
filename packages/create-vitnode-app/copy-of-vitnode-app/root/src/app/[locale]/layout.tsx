import type { RootLayoutProps } from '@vitnode/core/views/layouts/root-layout';
import {
  generateMetadataRootLayout,
  RootLayout,
} from '@vitnode/core/views/layouts/root-layout';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { vitNodeConfig } from '@/vitnode.config';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const generateMetadata = (): Metadata =>
  generateMetadataRootLayout(vitNodeConfig);

export const generateStaticParams = () =>
  vitNodeConfig.i18n.locales.map(locale => ({ locale: locale.code }));

export default async function LocaleLayout(props: RootLayoutProps) {
  const { locale } = await props.params;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RootLayout config={vitNodeConfig} {...props} />
      </body>
    </html>
  );
}
