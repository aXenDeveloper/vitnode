import type { ProgressProvider } from "@bprogress/next/app";
import type { drizzle } from "drizzle-orm/postgres-js";
import type { ThemeProvider } from "next-themes";
import type { IRateLimiterOptions } from "rate-limiter-flexible";
import type React from "react";

import type { CronAdapter } from "./api/lib/cron";
import type { BuildPluginApiReturn } from "./api/lib/plugin";
import type { EmailApiPlugin } from "./api/models/email";
import type { SSOApiPlugin } from "./api/models/sso";
import type { DefaultTemplateEmailProps } from "./emails/default-template";
import type { BuildPluginReturn } from "./lib/plugin";

export interface LocaleConfig {
  code: string;
  name: string;
}

export interface VitNodeConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  debug?: boolean;
  i18n: {
    defaultLocale: AppLocales[number]["code"];
    localePrefix?: "always" | "as-needed" | "never";
    locales: AppLocales;
    timeZone?: string;
  };
  metadata: VitNodeApiConfig["metadata"];
  plugins: BuildPluginReturn[];
  progressBar?: React.ComponentProps<typeof ProgressProvider>;
  theme?: Omit<
    React.ComponentProps<typeof ThemeProvider>,
    "attribute" | "disableTransitionOnChange" | "enableSystem"
  >;
}

export interface VitNodeApiConfig {
  authorization?: {
    adminCookieExpires?: number;
    adminCookieName?: string;
    cookieExpires?: number;
    cookieName?: string;
    cookieSecure?: boolean;
    deviceCookieExpires?: number;
    deviceCookieName?: string;
    ssoAdapters?: SSOApiPlugin[];
  };
  captcha?: {
    secretKey: string | undefined;
    siteKey: string | undefined;
    type: "cloudflare_turnstile" | "recaptcha_v3";
  };
  cronAdapter?: CronAdapter;
  dbProvider: ReturnType<typeof drizzle>;
  email?: {
    adapter?: EmailApiPlugin;
    logo?: DefaultTemplateEmailProps["templateProps"]["logo"];
    tailwindConfig?: DefaultTemplateEmailProps["templateProps"]["tailwindConfig"];
  };
  metadata: {
    shortTitle?: string;
    title: string;
  };
  pathToMessages: (path: string) => Promise<{ default: object }>;
  plugins: BuildPluginApiReturn[];
  rateLimiter?: Omit<IRateLimiterOptions, "keyPrefix">;
}

let registeredVitNodeConfig: undefined | VitNodeConfig;

export function buildConfig<AppLocales extends LocaleConfig[]>(
  args: VitNodeConfig<AppLocales>,
): VitNodeConfig<AppLocales> {
  const config = {
    ...args,
    i18n: {
      ...args.i18n,
      localePrefix: args.i18n.localePrefix ?? "as-needed",
    },
  };

  // Register the app config so framework-owned route files (e.g. the @breadcrumb
  // slots copied into apps) can read it without prop-drilling.
  registeredVitNodeConfig = config;

  return config;
}

/**
 * Returns the app's VitNodeConfig registered by {@link buildConfig} (called once
 * in the app's `vitnode.config.ts`). Used by framework route files that need the
 * config but aren't passed it as a prop.
 */
export const getVitNodeConfig = (): VitNodeConfig => {
  if (!registeredVitNodeConfig) {
    throw new Error(
      "VitNode config not initialized — ensure `buildConfig` runs in your vitnode.config.ts.",
    );
  }

  return registeredVitNodeConfig;
};

export function buildApiConfig(args: VitNodeApiConfig): VitNodeApiConfig {
  return args;
}

export const handleRequestConfig = async ({
  requestLocale,
  vitNodeConfig,
  pathToMessages,
}: {
  pathToMessages: (path: string) => Promise<{ default: object }>;
  requestLocale: Promise<string | undefined>;
  vitNodeConfig: VitNodeConfig;
}) => {
  const reqLocale = await requestLocale;
  const localeCodes = vitNodeConfig.i18n.locales.map(locale => locale.code);
  const locale =
    reqLocale && localeCodes.includes(reqLocale)
      ? reqLocale
      : vitNodeConfig.i18n.defaultLocale;

  const pluginIds: string[] = [
    "@vitnode/core",
    ...vitNodeConfig.plugins.map(plugin => plugin.pluginId),
  ];

  // Import and merge messages from all plugins
  const messagesPromises = pluginIds.map(async pluginId => {
    try {
      const path = `${pluginId}/${locale}.json`;
      const messages = await pathToMessages(path);

      return messages.default;
    } catch {
      return {};
    }
  });

  const allMessages = await Promise.all(messagesPromises);
  const messages = allMessages.reduce((acc, curr) => ({ ...acc, ...curr }), {});

  return {
    locale,
    messages,
    pluginIds,
    timeZone: vitNodeConfig.i18n.timeZone,
  };
};
