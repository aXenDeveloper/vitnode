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
import { DocsModeSync } from "./layout.client";

export const generateMetadata = (): Metadata =>
  generateMetadataRootLayout(vitNodeConfig);

export const generateStaticParams = () =>
  vitNodeConfig.i18n.locales.map(locale => ({ locale: locale.code }));

const geist = Geist({
  subsets: ["latin"],
});

/**
 * Paints the docs section class on `<body>` before first paint.
 *
 * `<body>` cannot be wrapped in `<Suspense>`, so the class cannot come from a
 * `useParams()` read during prerendering without making every route block.
 * Deriving it from `location.pathname` here keeps the shell static; the
 * `DocsModeSync` component below takes over for client navigations.
 */
const docsModeScript = `(function(){var p=location.pathname.split("/"),i=p.indexOf("docs"),m=i<0?"":p[i+1];if(m)document.body.classList.add(m)})()`;

export default async function Layout(props: RootLayoutProps) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geist.className} antialiased`}
        suppressHydrationWarning
      >
        {/* eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml */}
        <script dangerouslySetInnerHTML={{ __html: docsModeScript }} />
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
