import type { Metadata } from "next/dist/types";
import type React from "react";

import type { VitNodeConfig } from "@/vitnode.config";

import { I18nProvider } from "@/components/i18n-provider";
import { titleTemplate } from "@/lib/metadata";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import { RootProvider } from "./provider";

export interface RootLayoutProps {
  children: React.ReactNode;
  params?: Promise<{
    locale: string;
  }>;
}

export const generateMetadataRootLayout = ({
  metadata,
}: VitNodeConfig): Metadata => {
  return {
    title: {
      default: metadata.title,
      template: titleTemplate(metadata),
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
