import type { Metadata } from "next";

import "../global.css";

import {
  generateMetadataRootLayout,
  RootLayout,
  type RootLayoutProps,
} from "@vitnode/core/views/layouts/root-layout";
import { RootProvider } from "fumadocs-ui/provider/next";
import { getLocale } from "next-intl/server";
import { Geist } from "next/font/google";
import { Suspense } from "react";

import { vitNodeConfig } from "@/vitnode.config";

import SearchDialogFumadocs from "../../components/fumadocs/search-dialog";
import { DocsModeScript, DocsModeSync } from "./layout.client";

export const generateMetadata = (): Metadata =>
  generateMetadataRootLayout(vitNodeConfig);

export const generateStaticParams = () =>
  vitNodeConfig.i18n.locales.map(locale => ({ locale: locale.code }));

const geist = Geist({
  subsets: ["latin"],
});

export default async function Layout(props: RootLayoutProps) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geist.className} antialiased`}
        suppressHydrationWarning
      >
        <DocsModeScript />
        <Suspense>
          <DocsModeSync />
        </Suspense>

        <RootProvider
          search={{
            SearchDialog: SearchDialogFumadocs,
          }}
          theme={{ enabled: false }}
        >
          <RootLayout config={vitNodeConfig} {...props} />
        </RootProvider>
      </body>
    </html>
  );
}
