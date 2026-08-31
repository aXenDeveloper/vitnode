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

/**
 * The slice of the config the provider tree needs.
 *
 * Deliberately not the whole `VitNodeConfig`: `plugins` and `i18n.messages` hold
 * functions, which neither React nor a route loader can carry to the browser -
 * and on a framework without Server Components, importing the module they live
 * in is what drags an admin form into the client bundle.
 */
export interface VitNodeProvidersConfig extends Pick<
  VitNodeConfig,
  "debug" | "theme"
> {
  locales: LocaleConfig[];
}

/**
 * Every provider a VitNode page needs and no framework does.
 *
 * Theme, toasts, the rate-limit listener, tooltips and the language list: none
 * of them know which router rendered them, so both the Next.js app and the
 * TanStack Start app mount this same tree. What each framework *does* own stays
 * outside it - the progress bar and Query integration in Next.js
 * (`views/layouts/provider.tsx`), the router-owned QueryClient in TanStack Start.
 *
 * `ThemeProvider` sits outermost because `Toaster` reads the resolved theme, and
 * the no-flash script that paints the theme before React exists is rendered by
 * the shell instead (see `components/theme-script.tsx`).
 */
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
