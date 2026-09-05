"use client";

import React from "react";

import type { LocaleConfig } from "@/lib/i18n/types";
import type { VitNodeConfig } from "@/vitnode.config";

import { LanguagesProvider } from "@/components/languages-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CONFIG } from "@/lib/config";

import { RateLimitListener } from "./rate-limit-listener";

export interface VitNodeProvidersConfig extends Pick<
  VitNodeConfig,
  "debug" | "theme"
> {
  locales: LocaleConfig[];
}

export const VitNodeProviders = ({
  children,
  toaster,
  config: { debug, locales, theme },
}: {
  children: React.ReactNode;
  config: VitNodeProvidersConfig;
  toaster?: React.ComponentProps<typeof Toaster>;
}) => {
  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (!(debug && CONFIG.node_development)) return;

    void import("react-scan").then(({ scan }) => scan({ enabled: true }));
  }, [debug]);

  return (
    <ThemeProvider
      attribute="class"
      disableTransitionOnChange
      enableSystem
      {...theme}
    >
      <Toaster
        closeButton
        position={toaster?.position ?? "top-center"}
        {...toaster}
      />
      <RateLimitListener />
      <TooltipProvider>
        <LanguagesProvider languages={locales}>{children}</LanguagesProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};
