import type { Metadata } from "next/dist/types";
import type React from "react";

import { setRequestLocale } from "next-intl/server";

import type { VitNodeConfig } from "@/vitnode.config";

import { I18nProvider } from "@/components/i18n-provider";
import { VitNodeWebSocketProvider } from "@/ws/provider";

import { RootProvider } from "./provider";

export interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{
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

export const RootLayout = async ({
  children,
  params,
  config,
}: RootLayoutProps & {
  config: VitNodeConfig;
}) => {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <I18nProvider namespaces={[]}>
      <RootProvider config={config}>
        <VitNodeWebSocketProvider>{children}</VitNodeWebSocketProvider>
      </RootProvider>
    </I18nProvider>
  );
};
