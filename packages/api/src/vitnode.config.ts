import type { drizzle } from "drizzle-orm/postgres-js";

import type { DefaultTemplateEmailProps } from "./emails/default-template";
import type { CacheConfig } from "./lib/cache";
import type { CronAdapter } from "./lib/cron";
import type { VitNodeApiI18nConfig } from "./lib/i18n/types";
import type { VitNodeMetadata } from "./lib/metadata";
import type { NotificationWorkerSettings } from "./lib/notifications/preferences";
import type { OgImageConfig } from "./lib/og-image/types";
import type { PasskeysConfig } from "./lib/passkey-config";
import type { PaymentProviderApiPlugin } from "./lib/payments/provider";
import type { BuildPluginApiReturn } from "./lib/plugin";
import type { FrontendPluginInventory } from "./lib/plugin-manifest";
import type { UpdateChannel } from "./lib/updates/manifest";
import type { PersonalInformationFieldsConfig } from "./lib/user-personal-information";
import type { RateLimiterConfig } from "./middlewares/rate-limiter-config";
import type { AIConfig } from "./models/ai";
import type { EmailApiPlugin } from "./models/email";
import type { EventsApiPlugin } from "./models/events";
import type { SearchProviderApiPlugin } from "./models/search";
import type { SSOApiPlugin } from "./models/sso";
import type { StorageApiPlugin } from "./models/storage";

export type { LocaleConfig, VitNodeApiI18nConfig } from "./lib/i18n/types";
export type { VitNodeMetadata } from "./lib/metadata";

/**
 * An API's configuration, written in `src/vitnode.api.config.ts` with
 * {@link buildApiConfig}. Server-only: it holds the database and secrets.
 */
export interface VitNodeApiConfig {
  /** The Activity Logs (audit log) the AdminCP shows under Staff. */
  activityLogs?: {
    /**
     * How many days an entry is kept. A daily job deletes older entries, in
     * batches. `0` keeps everything. A whole number from `0`; anything else
     * falls back to the default. Defaults to `365`.
     */
    retentionDays?: number;
  };
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
   * Generated social cards (`og:image`): the built-in template draws the site
   * name, a page's title and description at 1200 × 630. On by default; see
   * {@link OgImageConfig} for fonts, colours and templates.
   */
  ogImage?: OgImageConfig;
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
  /**
   * Hosted-checkout payments, used by plugins through `c.get("payments")`.
   * Without providers the rest of VitNode works as usual, and creating a
   * payment fails with `provider_not_found`.
   */
  payments?: {
    /**
     * How long a hosted checkout accepts payment, in minutes. Clamped to
     * 30-1380 (23 hours, inside the providers' 24-hour idempotency window).
     * Defaults to 60.
     */
    checkoutExpiresInMinutes?: number;
    /**
     * The provider instances, e.g. `StripePaymentAdapter({ id: "stripe-main", ... })`
     * from `@vitnode/stripe`. Each `id` must be unique: it is stored on every
     * payment and names the instance's webhook URL,
     * `/api/@vitnode/core/payments/webhooks/{id}`. Duplicate or malformed ids
     * stop the API from starting.
     */
    providers?: PaymentProviderApiPlugin[];
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
 * import { coreRelations } from "@vitnode/api/database/relations";
 * import { buildApiConfig } from "@vitnode/api/vitnode.config";
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
