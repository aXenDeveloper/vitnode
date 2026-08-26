"use client";

import { ProgressProvider } from "@bprogress/next/app";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import type { ProgressBarConfig } from "@/components/progress-bar";
import type { Toaster } from "@/components/ui/sonner";

import { NextThemeScript } from "@/components/theme-script-next";
import { createVitNodeQueryClient } from "@/lib/query-client";

import type { VitNodeProvidersConfig } from "./providers";

import { VitNodeProviders } from "./providers";

/**
 * The provider config of a Next.js app: the shared one plus the progress bar,
 * which is driven by Next's router and so belongs to this half.
 */
export interface RootProviderConfig extends VitNodeProvidersConfig {
  progressBar?: ProgressBarConfig;
}

/**
 * The Next.js half of VitNode's provider tree.
 *
 * Three things only: the QueryClient (Next has no router to own one, so the
 * outermost client component does), the theme's no-flash script - inserted
 * through `useServerInsertedHTML`, which is Next's mechanism and nobody else's -
 * and `@bprogress/next`, which hooks Next's own navigation events.
 *
 * Everything else moved to {@link VitNodeProviders}, which the TanStack Start
 * app mounts too. Nothing is rendered twice: the QueryClient lives here, so
 * `apps/web` must not create another one - its router does that instead.
 */
export const RootProvider = ({
  children,
  toaster,
  config: { progressBar, ...providers },
}: {
  children: React.ReactNode;
  config: RootProviderConfig;
  toaster?: React.ComponentProps<typeof Toaster>;
}) => {
  const [queryClient] = React.useState(createVitNodeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemeScript {...providers.theme} />

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
        <VitNodeProviders config={providers} toaster={toaster}>
          {children}
        </VitNodeProviders>
      </ProgressProvider>
    </QueryClientProvider>
  );
};
