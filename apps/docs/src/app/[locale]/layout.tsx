import type { RootLayoutProps } from "@vitnode/core/views/layouts/root-layout";
import {
  generateMetadataRootLayout,
  RootLayout,
} from "@vitnode/core/views/layouts/root-layout";
import { RootProvider } from "fumadocs-ui/provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { vitNodeConfig } from "@/vitnode.config";

import SearchDialogFumadocs from "../../components/fumadocs/search-dialog";
import { Body } from "./(main)/layout.client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const generateMetadata = (): Metadata =>
  generateMetadataRootLayout(vitNodeConfig);

export const generateStaticParams = () =>
  vitNodeConfig.i18n.locales.map(locale => ({ locale: locale.code }));

export default async function LocaleLayout(props: RootLayoutProps) {
  const { locale } = await props.params;

  return (
    <html lang={locale} suppressHydrationWarning>
      <Body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RootProvider
          search={{
            SearchDialog: SearchDialogFumadocs,
          }}
        >
          <RootLayout config={vitNodeConfig} {...props} />
        </RootProvider>
      </Body>
    </html>
  );
}
