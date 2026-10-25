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

import { RateLimitListener } from "./rate-limit-listener";

export interface VitNodeProvidersConfig extends Pick<
  VitNodeConfig,
  "editor" | "logo" | "theme"
> {
  locales: LocaleConfig[];
}

export const VitNodeProviders = ({
  children,
  toaster,
  config: { editor, locales, logo: Logo = LogoVitNodeBrand, theme },
}: {
  children: React.ReactNode;
  config: VitNodeProvidersConfig;
  toaster?: React.ComponentProps<typeof Toaster>;
}) => {
  const logo = React.useMemo(() => <Logo />, [Logo]);

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
