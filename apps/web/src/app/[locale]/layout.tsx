import type { Metadata } from 'next';
import type { RootLayoutProps } from 'vitnode/views/layouts/root-layout';

import { vitNodeConfig } from '@/vitnode.config';
import { Geist, Geist_Mono } from 'next/font/google';
import {
  generateMetadataRootLayout,
  RootLayout,
} from 'vitnode/views/layouts/root-layout';

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
  vitNodeConfig.i18n.locales.map(locale => ({ locale }));

export default function LocaleLayout(props: RootLayoutProps) {
  return (
    <RootLayout
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      config={vitNodeConfig}
      {...props}
    />
  );
}
