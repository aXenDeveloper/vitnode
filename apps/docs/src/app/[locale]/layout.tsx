import type { Metadata } from "next";

import "../global.css";

import {
  generateMetadataRootLayout,
  RootLayout,
  type RootLayoutProps,
} from "@vitnode/core/views/layouts/root-layout";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Geist } from "next/font/google";

import { vitNodeConfig } from "@/vitnode.config";

import SearchDialogFumadocs from "../../components/fumadocs/search-dialog";
import { Body } from "./layout.client";

export const generateMetadata = (): Metadata =>
  generateMetadataRootLayout(vitNodeConfig);

export const generateStaticParams = () =>
  vitNodeConfig.i18n.locales.map(locale => ({ locale: locale.code }));

const geist = Geist({
  subsets: ["latin"],
});

export default async function Layout(props: RootLayoutProps) {
  const { locale } = await props.params;

  return (
    <html lang={locale} suppressHydrationWarning>
      <Body className={`${geist.className} antialiased`}>
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
