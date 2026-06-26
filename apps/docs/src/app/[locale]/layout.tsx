import type { Metadata } from "next";

import "../global.css";

import {
  generateMetadataRootLayout,
  RootLayout,
  type RootLayoutProps,
} from "@vitnode/core/views/layouts/root-layout";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Geist, Geist_Mono } from "next/font/google";

import { vitNodeConfig } from "@/vitnode.config";

import SearchDialogFumadocs from "../../components/fumadocs/search-dialog";
import { Body } from "./layout.client";

export const generateMetadata = (): Metadata =>
  generateMetadataRootLayout(vitNodeConfig);

export const generateStaticParams = () =>
  vitNodeConfig.i18n.locales.map(locale => ({ locale: locale.code }));

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function Layout(props: RootLayoutProps) {
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
          theme={{ enabled: false }}
        >
          <RootLayout config={vitNodeConfig} {...props} />
        </RootProvider>
      </Body>
    </html>
  );
}
