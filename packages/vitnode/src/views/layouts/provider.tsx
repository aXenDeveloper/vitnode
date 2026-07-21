"use client";

import { ProgressProvider } from "@bprogress/next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { scan } from "react-scan";

import type { VitNodeConfig } from "@/vitnode.config";

import { CONFIG } from "@/lib/config";

import { LanguagesProvider } from "../../components/languages-provider";
import { ThemeProvider } from "../../components/theme-provider";
import { Toaster } from "../../components/ui/sonner";
import { TooltipProvider } from "../../components/ui/tooltip";
import { RateLimitListener } from "./rate-limit-listener";

export const RootProvider = ({
  children,
  toaster,
  config: { debug, theme, progressBar, i18n },
}: {
  children: React.ReactNode;
  config: VitNodeConfig;
  toaster?: React.ComponentProps<typeof Toaster>;
}) => {
  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (!(debug && CONFIG.node_development)) return;

    scan({
      enabled: true,
    });
  }, [debug]);

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnMount: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
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
        <ProgressProvider
          {...progressBar}
          color={progressBar?.color ?? "var(--primary)"}
          height={progressBar?.height ?? "4px"}
          options={{
            showSpinner: false,
            ...progressBar?.options,
          }}
          shallowRouting={progressBar?.shallowRouting ?? true}
        >
          <TooltipProvider>
            <LanguagesProvider languages={i18n.locales}>
              {children}
            </LanguagesProvider>
          </TooltipProvider>
        </ProgressProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
