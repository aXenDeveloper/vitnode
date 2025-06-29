import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { ThemeProvider } from 'next-themes';
import type { IRateLimiterOptions } from 'rate-limiter-flexible';

import type { BuildPluginApiReturn } from './api/lib/plugin';
import type { EmailApiPlugin } from './api/models/email';
import type { SSOApiPlugin } from './api/models/sso';
import type { BuildPluginReturn } from './lib/plugin';

export interface LocaleConfig {
  code: string;
  name: string;
}

export interface VitNodeConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  admin?: {
    sidebarCookieName?: string;
  };
  debug?: boolean;
  i18n: {
    defaultLocale: AppLocales[number]['code'];
    localePrefix?: 'always' | 'as-needed' | 'never';
    locales: AppLocales;
    timeZone?: string;
  };
  metadata: {
    shortTitle?: string;
    title: string;
  };
  plugins: BuildPluginReturn[];
  theme?: Omit<
    React.ComponentProps<typeof ThemeProvider>,
    'attribute' | 'disableTransitionOnChange' | 'enableSystem'
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
    type: 'cloudflare_turnstile' | 'recaptcha_v3';
  };
  dbProvider: PostgresJsDatabase;
  emailAdapter?: EmailApiPlugin;
  plugins: BuildPluginApiReturn[];
  rateLimiter?: Omit<IRateLimiterOptions, 'keyPrefix'>;
}

export function buildConfig<AppLocales extends LocaleConfig[]>(
  args: VitNodeConfig<AppLocales>,
): VitNodeConfig<AppLocales> {
  return {
    ...args,
    i18n: {
      ...args.i18n,
      localePrefix: args.i18n.localePrefix ?? 'as-needed',
    },
  };
}

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
    '@vitnode/core',
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
