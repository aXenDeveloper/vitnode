import React from "react";

import type { LocaleConfig } from "@/lib/i18n/types";
import type { VitNodeConfig } from "@/vitnode.config";

import { EditWidgetsHost } from "@/blocks/edit-widgets-host";
import { EditorConfigProvider } from "@/components/editor-provider";
import { LanguagesProvider } from "@/components/languages-provider";
import { LogoContext } from "@/components/logo-context";
import { LogoVitNodeBrand } from "@/components/logo-vitnode";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CONFIG } from "@/lib/config";

import { RateLimitListener } from "./rate-limit-listener";

export interface VitNodeProvidersConfig extends Pick<
  VitNodeConfig,
  "debug" | "editor" | "logo" | "theme"
> {
  locales: LocaleConfig[];
}

export const VitNodeProviders = ({
  children,
  toaster,
  config: { debug, editor, locales, logo: Logo = LogoVitNodeBrand, theme },
}: {
  children: React.ReactNode;
  config: VitNodeProvidersConfig;
  toaster?: React.ComponentProps<typeof Toaster>;
}) => {
  const logo = React.useMemo(() => <Logo />, [Logo]);

  React.useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
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
      <Toaster closeButton {...toaster} />
      <RateLimitListener />
      <TooltipProvider>
        <LanguagesProvider languages={locales}>
          <EditorConfigProvider config={editor}>
            <LogoContext value={logo}>
              <EditWidgetsHost>{children}</EditWidgetsHost>
            </LogoContext>
          </EditorConfigProvider>
        </LanguagesProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};
