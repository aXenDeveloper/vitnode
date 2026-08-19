import type { Metadata } from "next/dist/types";
import type React from "react";

import type { VitNodeConfig } from "@/vitnode.config";

import { I18nProvider } from "@/components/i18n-provider";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import { RootProvider } from "./provider";

export interface RootLayoutProps {
  children: React.ReactNode;
  /**
   * Still handed over by Next, and still spread through by app layouts, but no
   * longer read here: the locale now comes from `next/root-params` via the
   * next-intl request config. Optional so a layout that has stopped destructuring
   * it type-checks.
   */
  params?: Promise<{
    locale: string;
  }>;
}

export const generateMetadataRootLayout = ({
  metadata: { title, shortTitle },
}: VitNodeConfig): Metadata => {
  return {
    title: {
      default: title,
      template: `%s - ${shortTitle ?? title}`,
    },
  };
};

export const RootLayout = ({
  children,
  config,
}: RootLayoutProps & {
  config: VitNodeConfig;
}) => {
  return (
    <I18nProvider namespaces={[]}>
      <RootProvider
        // Hand over only the serialisable slice - the rest of the config
        // (plugins, message loaders) stays on the server.
        config={{
          debug: config.debug,
          locales: config.i18n.locales,
          progressBar: config.progressBar,
          theme: config.theme,
        }}
      >
        <VitNodeWebSocketProvider>{children}</VitNodeWebSocketProvider>
      </RootProvider>
    </I18nProvider>
  );
};
