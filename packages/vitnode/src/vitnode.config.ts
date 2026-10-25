import type { drizzle } from "drizzle-orm/postgres-js";

import type { CacheConfig } from "./api/lib/cache";
import type { CronAdapter } from "./api/lib/cron";
import type { NotificationWorkerSettings } from "./api/lib/notifications/preferences";
import type { PasskeysConfig } from "./api/lib/passkey-config";
import type { BuildPluginApiReturn } from "./api/lib/plugin";
import type { RateLimiterConfig } from "./api/middlewares/rate-limiter-config";
import type { AIConfig } from "./api/models/ai";
import type { EmailApiPlugin } from "./api/models/email";
import type { EventsApiPlugin } from "./api/models/events";
import type { SearchProviderApiPlugin } from "./api/models/search";
import type { SSOApiPlugin } from "./api/models/sso";
import type { StorageApiPlugin } from "./api/models/storage";
import type { VitNodeEditorConfig } from "./components/editor-provider";
import type { VitNodeLogo } from "./components/logo-context";
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
import type { NavigationConfig } from "./lib/navigation";
import type { BuildPluginReturn } from "./lib/plugin";
import type { FrontendPluginInventory } from "./lib/plugin-manifest";
import type { UpdateChannel } from "./lib/updates/manifest";
import type { PersonalInformationFieldsConfig } from "./lib/user-personal-information";
import type { OgImagesConfig } from "./og-image/server/types";
import type { PageCacheConfig } from "./page-cache/config";

import { assertNavigationConfig } from "./lib/navigation";

export type { LocaleConfig };

/**
 * An app's frontend configuration, written in `src/vitnode.config.ts` with
 * {@link buildConfig}. It reaches the browser, so it must not hold secrets;
 * server-only settings go in {@link VitNodeServerConfig} and
 * {@link VitNodeApiConfig}.
 */
export interface VitNodeConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /** Starts `react-scan` render highlighting in development. Ignored in production. */
  debug?: boolean;
  /** Editor settings shared by every `Editor` in the app. */
  editor?: VitNodeEditorConfig;
  /** Languages and locale routing. */
  i18n: VitNodeI18nConfig<AppLocales>;
  /** The site logo component. Defaults to the VitNode logo. */
  logo?: VitNodeLogo;
  /** The site title, used in page titles as `{page} - {shortTitle ?? title}`. */
  metadata: VitNodeMetadata;
  /**
   * The header menu and the mobile bottom bar. Titles are message keys, and
   * `buildConfig` checks them along with the links.
   */
  navigation?: NavigationConfig;
  /**
   * The server-rendered HTML cache: where it is stored, and per-route
   * overrides of the policies plugins declare. See `PageCacheConfig`.
   */
  pageCache?: PageCacheConfig;
  /**
   * The installed plugins' frontend halves, each a plugin's `buildPlugin()`
   * result. The VitNode Vite plugin reads this list to generate the app's plugin
   * routes, API registry, AdminCP registries and message loaders.
   */
  plugins: BuildPluginReturn[];
  /** Theme provider options, e.g. `defaultTheme: "system"`. */
  theme?: Omit<
    ThemeProviderProps,
    "attribute" | "children" | "disableTransitionOnChange" | "enableSystem"
  >;
  /**
   * `false` turns off page view transitions (the page fade and the logo
   * morph). The app's router reads it through `navigationViewTransition()`
   * from `@vitnode/core/tanstack/view-transitions`. Defaults to on.
   */
  viewTransitions?: boolean;
}

/**
 * The frontend settings only the server reads, written with
 * {@link buildServerConfig} in a module the browser bundle never imports.
 */
export interface VitNodeServerConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /** The shared config this app also serves to the browser. */
  config: VitNodeConfig<AppLocales>;

  /**
   * The app's own translations, merged over the packages' strings: keyed by
   * locale, then by namespace - a package id to override that package, or the
   * app's own namespace.
   */
  messages?: AppMessagesMap;

  /** Each package's message loaders - the generated `src/package-messages.gen.ts`. */
  packageMessages?: Record<string, LocaleMessagesMap | undefined>;
}

/**
 * An API's configuration, written in `src/vitnode.api.config.ts` with
 * {@link buildApiConfig}. Server-only: it holds the database and secrets.
 */
export interface VitNodeApiConfig {
  /** AI models and providers, resolved through `c.get("ai")`. AI features are off without it. */
  ai?: AIConfig;
  /** Sessions, cookies and sign-in methods. */
  authorization?: {
    /**
     * How long an AdminCP session lasts without activity, in milliseconds;
     * activity extends it. Defaults to one hour.
     */
    adminCookieExpires?: number;
    /** Defaults to `vitnode_auth_admin`. */
    adminCookieName?: string;

    /**
     * The `Domain` of the auth cookies, to share a session across subdomains.
     * Unset means host-only cookies, right for most installs.
     */
    cookieDomain?: string;
    /** Session lifetime in milliseconds. Defaults to 90 days. */
    cookieExpires?: number;
    /** Defaults to `vitnode_auth`. */
    cookieName?: string;
    /** Sets `Secure` on the auth cookies. Defaults to `true`; turn off only for plain-HTTP development. */
    cookieSecure?: boolean;
    /** How long a device is remembered, in milliseconds. Defaults to one year. */
    deviceCookieExpires?: number;
    /** Defaults to `vitnode_device`. */
    deviceCookieName?: string;
    /**
     * Enables passkey sign-in. Off by default; `true` uses the web origin
     * (`VITNODE_WEB_URL`) as the only origin and its host as the RP ID.
     * Misconfigured origins or RP ID stop the API from starting.
     */
    passkeys?: boolean | PasskeysConfig;
    /** Email and password sign-in. Defaults to `true`. */
    password?: boolean;
    /** Single sign-on providers. Defaults to none. */
    ssoAdapters?: SSOApiPlugin[];
  };
  /**
   * Requires a captcha on routes built with `withCaptcha`. Without it those
   * routes skip the check.
   */
  captcha?: {
    /** The provider's secret key. A missing key fails every captcha check. */
    secretKey: string | undefined;
    /** The public key the browser renders the widget with. */
    siteKey: string | undefined;
    type: "cloudflare_turnstile" | "recaptcha_v3";
  };
  /** Content Engine settings that are deployment-shaped rather than per type. */
  content?: {
    /**
     * Front-end origins told to revalidate their cached content after a
     * background write (a scheduled publish, say): each one gets a POST to
     * `{origin}/api/vitnode/content/revalidate` carrying `CRON_SECRET`.
     * Outside development, only `https` origins (or `http` on localhost) are
     * notified, and only once `CRON_SECRET` is set to a non-default value.
     */
    revalidateOrigins?: string[];
  };
  /**
   * The web build's generated `src/content-modules.gen.ts`. At startup the API
   * checks that every plugin publishing content URLs also exports those
   * content types from its `./content` module, which is how the web build
   * checks a page serves each URL. Without it, each plugin's `./content` is
   * resolved from the working directory instead.
   */
  contentModules?: Readonly<Record<string, unknown>>;
  /**
   * Runs the registered cron jobs on an in-process scheduler (e.g.
   * `@vitnode/node-cron`, ticking every minute). Its `schedule()` is called
   * once at startup; without it, jobs run only when the cron endpoint is
   * called externally.
   */
  cron?: CronAdapter;
  /** The Drizzle database, available to routes as `c.get("db")`. */
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
  /** Outgoing email. Sending fails with a `500` until an `adapter` is set. */
  email?: {
    /** The email provider, e.g. `@vitnode/nodemailer` or `@vitnode/resend`. */
    adapter?: EmailApiPlugin;
    /** The logo in the default email template. */
    logo?: DefaultTemplateEmailProps["templateProps"]["logo"];
    /** Tailwind theme overrides for the default email template. */
    tailwindConfig?: DefaultTemplateEmailProps["templateProps"]["tailwindConfig"];
  };

  /** How `c.get("events")` delivers events to listeners. */
  events?: {
    /** Where events are dispatched. Defaults to the in-process adapter. */
    adapter?: EventsApiPlugin;
  };

  /**
   * The web build's generated `src/plugin-inventory.gen.ts`, so the AdminCP
   * can list plugins installed only on the frontend and check them for updates.
   */
  frontendPlugins?: FrontendPluginInventory;

  /** The API's locales and server-side message overrides. Usually the app's own `i18n` block. */
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
  /** The site title, used in emails and as the passkey RP name. */
  metadata: VitNodeMetadata;
  /**
   * Notification worker tuning. Integers only, clamped to safe ranges. Defaults:
   * `emailBatchSize` 50, `emailConcurrency` 4, `fanoutBatchSize` 500,
   * `retentionDays` 90.
   */
  notifications?: Partial<NotificationWorkerSettings>;
  /**
   * Generated Open Graph images (1200 × 630 PNG, laid out with Satori and
   * rasterized with resvg).
   * Off without it; `ogImages: {}` turns them on with the built-in template
   * and the bundled fonts. Content types opt in with
   * `delivery.seo.openGraph.image`, and plugins call `ogImageResponse` from
   * `@vitnode/core/og-image/server` in their own routes.
   *
   * @example
   * ```ts
   * import { defaultOgImageTemplateEntry } from "@vitnode/core/og-image/server";
   *
   * import { productTemplate } from "./og/product-template";
   *
   * ogImages: {
   *   defaultTemplate: "default",
   *   templates: {
   *     default: defaultOgImageTemplateEntry,
   *     product: { version: "1", render: productTemplate },
   *   },
   * },
   * ```
   */
  ogImages?: OgImagesConfig;
  /**
   * For an API that runs in its own process, next to a web app that caches
   * pages in Redis (`vitNodeConfig.pageCache.storage: "redis"`). Content
   * writes then invalidate those pages through the same `REDIS_URL`. An API
   * mounted inside the web app needs nothing here - it shares the web app's
   * cache.
   */
  pageCache?: {
    /** The longest `maxAge + staleWhileRevalidate` of any cached route, in seconds. Defaults to a day. */
    maxLifetime?: number;
    storage: "redis";
  };
  /** The installed plugins' API halves, each a plugin's `buildApiPlugin()` result. Core is added automatically. */
  plugins: BuildPluginApiReturn[];
  /**
   * Request limits per category. `safety` and `auth` are always counted per
   * IP; `read`, `write` and `contentWrite` are counted per signed-in user when
   * `perUser` is on (the default), else per IP. Stored in Redis when `redis`
   * is set, in memory otherwise.
   */
  rateLimiter?: RateLimiterConfig;

  /**
   * Redis connection options (node-redis `createClient`), e.g. `{ url:
   * process.env.REDIS_URL }`. Enables `c.get("cache")`, a shared rate-limit
   * store and cross-instance WebSocket messages. Without it caching is a no-op.
   */
  redis?: CacheConfig;

  /** The search engine behind `c.get("search")` and the site search. */
  search?: {
    /** The search provider. Defaults to PostgreSQL full-text search. */
    adapter?: SearchProviderApiPlugin;
  };

  /** File uploads, served through `c.get("storage")`. */
  storage?: {
    /**
     * Where uploaded files are stored. Without one, uploads fail with `500`.
     */
    adapter?: StorageApiPlugin;

    /** Re-encodes uploaded images with `sharp`. Images are stored as uploaded when unset. */
    image?: {
      /** Largest image accepted, in total pixels. Defaults to 40,000,000. */
      maxPixels?: number;
      /** Encoder quality, 1-100. Defaults to 85. */
      quality?: number;
      /** Converts images to WebP. Defaults to `true`. */
      webp?: boolean;
    };
  };
  /**
   * Update and security-update checks for core and plugins, shown in
   * AdminCP → System → Plugins. They read public JSON manifests once a day and
   * never install anything.
   */
  updates?: {
    /**
     * The release channel to compare against. Defaults to the channel of the
     * installed version: `2.1.0` follows stable, `-rc.N` rc, `-canary.N`
     * canary. Setting it is how an installation moves channels on purpose.
     */
    channel?: UpdateChannel;
    /** `false` turns checking off - for an install without outbound network access. Defaults to `true`. */
    enabled?: boolean;
  };
  /** Member profile settings. */
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

/**
 * Declares the app's frontend configuration and registers it for core's own
 * screens ({@link getVitNodeConfig}). Fills `i18n.localePrefix` with
 * `"as-needed"` and `i18n.timeZone` with `"UTC"` when unset.
 *
 * Universal: the browser loads it too.
 *
 * @throws `NavigationConfigError` when `navigation` has an invalid link or
 * message key, more than three bottom-bar links, or too many message
 * namespaces.
 *
 * @example
 * ```ts
 * // src/vitnode.config.ts
 * import { blogPlugin } from "@vitnode/blog/config";
 * import { buildConfig } from "@vitnode/core/vitnode.config";
 *
 * export const vitNodeConfig = buildConfig({
 *   i18n: {
 *     defaultLocale: "en",
 *     locales: [{ code: "en", name: "English" }],
 *   },
 *   metadata: { title: "My community" },
 *   plugins: [blogPlugin()],
 * });
 * ```
 */
export function buildConfig<const AppLocales extends LocaleConfig[]>(
  args: VitNodeConfig<AppLocales>,
): VitNodeConfig<AppLocales> {
  assertNavigationConfig(args.navigation);

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

/**
 * Declares the server-only part of the frontend configuration: app message
 * overrides and the generated package message loaders. Import it only from
 * server code.
 */
export function buildServerConfig<const AppLocales extends LocaleConfig[]>(
  args: VitNodeServerConfig<AppLocales>,
): VitNodeServerConfig<AppLocales> {
  return args;
}

/**
 * The config {@link buildConfig} registered, for framework code that cannot
 * receive it as a prop.
 *
 * @throws When `buildConfig` has not run yet in this runtime.
 */
export const getVitNodeConfig = (): VitNodeConfig => {
  if (!registeredVitNodeConfig) {
    throw new Error(
      "VitNode config not initialized - ensure `buildConfig` runs in your vitnode.config.ts.",
    );
  }

  return registeredVitNodeConfig;
};

/**
 * Declares an API's configuration. Returns it unchanged; validation happens
 * when the API starts.
 *
 * Server-only.
 *
 * @example
 * ```ts
 * // src/vitnode.api.config.ts
 * import { blogApiPlugin } from "@vitnode/blog/config.api";
 * import { coreRelations } from "@vitnode/core/database/relations";
 * import { buildApiConfig } from "@vitnode/core/vitnode.config";
 * import { drizzle } from "drizzle-orm/postgres-js";
 *
 * export const vitNodeApiConfig = buildApiConfig({
 *   dbProvider: drizzle({
 *     connection: process.env.POSTGRES_URL ?? "",
 *     relations: coreRelations,
 *   }),
 *   metadata: { title: "My community" },
 *   plugins: [blogApiPlugin()],
 * });
 * ```
 */
export function buildApiConfig(args: VitNodeApiConfig): VitNodeApiConfig {
  return args;
}
