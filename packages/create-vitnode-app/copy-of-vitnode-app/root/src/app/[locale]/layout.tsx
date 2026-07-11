import type { Metadata } from "next";

import "../global.css";

import {
  generateMetadataRootLayout,
  RootLayout,
  type RootLayoutProps,
} from "@vitnode/core/views/layouts/root-layout";
import { Geist } from "next/font/google";

import { vitNodeConfig } from "@/vitnode.config";

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
      <body className={`${geist.className} antialiased`}>
        <RootLayout config={vitNodeConfig} {...props} />
      </body>
    </html>
  );
}
