import type { drizzle } from "drizzle-orm/postgres-js";
import type { IRateLimiterOptions } from "rate-limiter-flexible";

import type { CacheConfig } from "./api/lib/cache";
import type { CronAdapter } from "./api/lib/cron";
import type { BuildPluginApiReturn } from "./api/lib/plugin";
import type { AIConfig } from "./api/models/ai";
import type { EmailApiPlugin } from "./api/models/email";
import type { EventsApiPlugin } from "./api/models/events";
import type { SearchProviderApiPlugin } from "./api/models/search";
import type { SSOApiPlugin } from "./api/models/sso";
import type { StorageApiPlugin } from "./api/models/storage";
import type { VitNodeEditorConfig } from "./components/editor-provider";
import type { ThemeProviderProps } from "./components/theme-provider";
import type { DefaultTemplateEmailProps } from "./emails/default-template";
import type {
  AppMessagesMap,
  LocaleConfig,
  LocaleMessagesMap,
  VitNodeApiI18nConfig,
  VitNodeI18nConfig,
} from "./lib/i18n/types";
import type { VitNodeMetadata } from "./lib/metadata";
import type { BuildPluginReturn } from "./lib/plugin";
import type { PersonalInformationFieldsConfig } from "./lib/user-personal-information";

export type { LocaleConfig };

export interface VitNodeConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  debug?: boolean;
  /** Editor settings shared by every `Editor` in the app. */
  editor?: VitNodeEditorConfig;
  i18n: VitNodeI18nConfig<AppLocales>;
  metadata: VitNodeMetadata;
  plugins: BuildPluginReturn[];
  theme?: Omit<
    ThemeProviderProps,
    "attribute" | "children" | "disableTransitionOnChange" | "enableSystem"
  >;
}

export interface VitNodeServerConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /** The shared config this app also serves to the browser. */
  config: VitNodeConfig<AppLocales>;

  messages?: AppMessagesMap;

  packageMessages?: Record<string, LocaleMessagesMap | undefined>;
}

export interface VitNodeApiConfig {
  ai?: AIConfig;
  authorization?: {
    adminCookieExpires?: number;
    adminCookieName?: string;

    cookieDomain?: string;
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
  /** Content Engine settings that are deployment-shaped rather than per type. */
  content?: {
    revalidateOrigins?: string[];
  };
  cron?: CronAdapter;
  dbProvider: ReturnType<typeof drizzle>;
  /**
   * Publishes the OpenAPI document at `/swagger/doc` and Swagger UI at
   * `/swagger`.
   *
   * Defaults to on in development and **off** in production. The document names
   * every route, parameter and response shape the install has, the admin tree
   * included, and it is served without authentication - which is a map of the
   * attack surface handed to anyone who asks. Turn it on deliberately, and put
   * something in front of it if the install is public.
   */
  docs?: { enabled?: boolean };
  email?: {
    adapter?: EmailApiPlugin;
    logo?: DefaultTemplateEmailProps["templateProps"]["logo"];
    tailwindConfig?: DefaultTemplateEmailProps["templateProps"]["tailwindConfig"];
  };

  events?: {
    adapter?: EventsApiPlugin;
  };

  i18n?: VitNodeApiI18nConfig;
  /**
   * Largest request body the API will read, in bytes. Defaults to 25 MB.
   *
   * The outer wall, not the upload rule: a Content Engine file field has its own
   * `maxBytes` and is checked before a byte reaches storage. This exists because
   * without it nothing bounded a body at all, and `POST /sign_in` buffers its
   * JSON and then runs scrypt on it - memory and CPU whose size an
   * unauthenticated caller was choosing.
   */
  maxBodySize?: number;
  metadata: VitNodeMetadata;
  plugins: BuildPluginApiReturn[];
  rateLimiter?: Omit<IRateLimiterOptions, "keyPrefix">;

  redis?: CacheConfig;

  search?: {
    adapter?: SearchProviderApiPlugin;
  };

  storage?: {
    adapter?: StorageApiPlugin;

    image?: {
      quality?: number;
      webp?: boolean;
    };
  };
  users?: {
    /**
     * Which personal-information fields this install offers. Every field is on
     * unless it is set to `false`, and turning one off hides it from the
     * settings card and its form and makes the API refuse to write it - the
     * column keeps whatever it already held, so switching it back on restores
     * what members had set.
     */
    personalInformation?: PersonalInformationFieldsConfig;
  };
}

const DEFAULT_TIME_ZONE = "UTC";

let registeredVitNodeConfig: undefined | VitNodeConfig;

export function buildConfig<const AppLocales extends LocaleConfig[]>(
  args: VitNodeConfig<AppLocales>,
): VitNodeConfig<AppLocales> {
  const config = {
    ...args,
    i18n: {
      ...args.i18n,
      localePrefix: args.i18n.localePrefix ?? "as-needed",
      timeZone: args.i18n.timeZone ?? DEFAULT_TIME_ZONE,
    },
  };

  // Register the app config so framework-owned modules - core's own route
  // screens and breadcrumbs among them - can read it without prop-drilling.
  registeredVitNodeConfig = config;

  return config;
}

export function buildServerConfig<const AppLocales extends LocaleConfig[]>(
  args: VitNodeServerConfig<AppLocales>,
): VitNodeServerConfig<AppLocales> {
  return args;
}

export const getVitNodeConfig = (): VitNodeConfig => {
  if (!registeredVitNodeConfig) {
    throw new Error(
      "VitNode config not initialized - ensure `buildConfig` runs in your vitnode.config.ts.",
    );
  }

  return registeredVitNodeConfig;
};

export function buildApiConfig(args: VitNodeApiConfig): VitNodeApiConfig {
  return args;
}
