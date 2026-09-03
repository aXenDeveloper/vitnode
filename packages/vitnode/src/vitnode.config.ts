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

export type { LocaleConfig };

/**
 * An installation's shared configuration - `src/vitnode.config.ts`.
 *
 * **Browser-safe, and that is a contract rather than a happy accident.** The
 * document shell reads `metadata`, `theme` and `debug`; the locale runtime reads
 * `i18n`; the Vite plugin registry reads `plugins` while Vite is still loading
 * its config. So every value here has to survive being bundled for a browser and
 * being executed by `jiti` in Node - which means plain data and plugin
 * *identity*, never a `() => import(...)` message loader and never a module that
 * reaches a database.
 *
 * `plugins` holds each enabled plugin's registration - normally the plugin's own
 * factory, `blogPlugin()`. A Next.js host walks that list directly. A TanStack
 * Start host reads the same declarations back through build-time projections of
 * each plugin's `admin/nav` and `admin/content` exports, which is what gets an
 * editing screen loaded with the route that renders it rather than with the
 * config; `buildPlugin({ pluginId })` is the minimum such a host needs.
 *
 * Everything that cannot honour the browser-safe contract lives in
 * {@link VitNodeServerConfig}.
 */
export interface VitNodeConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  debug?: boolean;
  i18n: VitNodeI18nConfig<AppLocales>;
  metadata: VitNodeMetadata;
  plugins: BuildPluginReturn[];
  theme?: Omit<
    ThemeProviderProps,
    "attribute" | "children" | "disableTransitionOnChange" | "enableSystem"
  >;
}

/**
 * The half of an installation's configuration a browser may never hold -
 * `src/vitnode.server.config.ts`.
 *
 * Two things, and both are functions that read files out of a package's build
 * output: the app's own message overrides and the per-package loaders a bundled
 * runtime has to declare for itself (see `BundledMessagesOptions.packageMessages`).
 * Putting them beside `metadata` and `theme` is what used to force an app to
 * keep two configs that agreed until they didn't.
 *
 * It holds the shared config rather than repeating any of it, so the locale
 * list a message loader is resolved against is the same object the router and
 * the document shell read.
 */
export interface VitNodeServerConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /** The shared config this app also serves to the browser. */
  config: VitNodeConfig<AppLocales>;
  /**
   * Translations owned by the app rather than by a package, keyed by locale and
   * then by the plugin whose namespace they extend. Files live in
   * `src/locales/<pluginId>/<locale>.json`.
   */
  messages?: AppMessagesMap;
  /**
   * Where each installed package's translations are read from, keyed by plugin
   * id - core included.
   *
   * A bundled runtime cannot use the locale barrel a package ships, because
   * Rollup will not follow its `import("./en.json", { with: { type: "json" } })`.
   * An app declares static specifiers a bundler can follow instead.
   */
  packageMessages?: Record<string, LocaleMessagesMap | undefined>;
}

export interface VitNodeApiConfig {
  /**
   * AI models for the Vercel AI SDK. Declare them inline - each `model` is a
   * Gateway id string (e.g. `"anthropic/claude-sonnet-5"`, no extra packages,
   * uses `AI_GATEWAY_API_KEY`) or a provider instance (e.g.
   * `anthropic("claude-sonnet-5")` from `@ai-sdk/anthropic`). The first entry is
   * the default. In a route, resolve a model with `c.get("ai").model(id?)` and
   * pass it to the native SDK functions, e.g.
   * `generateText({ model: c.get("ai").model(), prompt })`. Leave undefined to
   * disable AI - resolving a model then throws "No AI models configured".
   */
  ai?: AIConfig;
  authorization?: {
    adminCookieExpires?: number;
    adminCookieName?: string;
    /**
     * `Domain` to stamp on the session, admin, device and SSO cookies.
     *
     * Leave it unset - the default - and no `Domain` is sent at all, making the
     * cookies *host-only*: valid on exactly the host that issued them. That is
     * what a normal VitNode install wants, because the web app serves `/api/*`
     * on its own origin, and it is the only setting that survives a hostname
     * nobody configured, such as a per-branch preview deployment.
     *
     * Set it only to share one session across subdomains - `".example.com"` for
     * `app.example.com` and `admin.example.com`. A value the response's own host
     * does not fall under is rejected by the browser, so an install that gets
     * this wrong cannot sign anybody in.
     *
     * Deliberately not derived from `NEXT_PUBLIC_WEB_URL`: that names where the
     * front end lives, which is not the same question, and guessing it is how a
     * preview deployment ends up sending `Domain=localhost`.
     */
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
    /**
     * Web origins to notify when background work changes what is public.
     *
     * Opt-in, and empty by default: only a front end that holds its own render
     * cache has anything to expire, and only that front end knows it. Set it to
     * the origins that serve `POST /api/vitnode/content/revalidate`, and each is
     * posted independently when one API serves several of them.
     *
     * Left unset, a background publish invalidates nothing beyond the API's own
     * cache - which is the whole story for a front end that reads through the
     * public content routes rather than caching renders of them.
     */
    revalidateOrigins?: string[];
  };
  cron?: CronAdapter;
  dbProvider: ReturnType<typeof drizzle>;
  email?: {
    adapter?: EmailApiPlugin;
    logo?: DefaultTemplateEmailProps["templateProps"]["logo"];
    tailwindConfig?: DefaultTemplateEmailProps["templateProps"]["tailwindConfig"];
  };
  /**
   * Transport for domain events emitted via `c.get("events").emit(...)`. Ships
   * a zero-config Local adapter used when `adapter` is omitted: listeners run
   * sequentially in the emitting request, on the emitting instance only
   * (single-process delivery). Swap the adapter to publish events to an
   * external broker (e.g. Redis Streams, NATS) for cross-instance delivery.
   */
  events?: {
    adapter?: EventsApiPlugin;
  };
  /**
   * Languages the API renders in - today that means emails, and anything a
   * route translates through `c.get("i18n")`.
   *
   * Optional: with no `i18n` block the locale list is derived from what the
   * installed packages ship and `defaultLocale` is `en`. When an app serves the
   * web and the API together, point this and `buildConfig` at the same object.
   */
  i18n?: VitNodeApiI18nConfig;
  metadata: VitNodeMetadata;
  plugins: BuildPluginApiReturn[];
  rateLimiter?: Omit<IRateLimiterOptions, "keyPrefix">;
  /**
   * Redis connection used as a shared cache (via `c.get("cache")`) and, when
   * set, as the storage backend for the rate limiter. Leave undefined to run
   * without Redis - the cache degrades to no-ops and the rate limiter falls
   * back to in-memory storage.
   */
  redis?: CacheConfig;
  /**
   * Search engine backing content discovery (`c.get("search")`). Ships a
   * zero-config Postgres full-text provider used when `adapter` is omitted; an
   * external Elasticsearch adapter is available as `@vitnode/elasticsearch`. The
   * canonical index always lives in `core_search_index`, so switching engines is
   * a config change followed by a rebuild.
   */
  search?: {
    adapter?: SearchProviderApiPlugin;
  };
  /**
   * Object storage backend used for file uploads, reached in route handlers via
   * `c.get("storage").upload(...)`. Ships a zero-config Local (disk) adapter;
   * cloud adapters are available as `@vitnode/s3` (AWS S3 + Cloudflare R2) and
   * `@vitnode/supabase-storage`. Leave undefined to disable uploads.
   */
  storage?: {
    adapter?: StorageApiPlugin;
    /**
     * Re-encode uploaded images with `sharp` before storing them, to shrink file
     * size. Set to enable; `quality` defaults to 85 (1–100). Applies to JPEG,
     * PNG, WebP, AVIF and TIFF - other files (incl. SVG/GIF) are stored as-is.
     *
     * Processed images are also converted to WebP by default (smaller than JPEG
     * or PNG at the same quality); set `webp: false` to keep each image in its
     * original format. Their pixel dimensions are recorded in
     * `core_files.metadata.dimensions` for display in the admin panel.
     */
    image?: {
      quality?: number;
      webp?: boolean;
    };
  };
}

let registeredVitNodeConfig: undefined | VitNodeConfig;

/**
 * Builds an installation's shared config - the one call in
 * `src/vitnode.config.ts`.
 *
 * `const AppLocales` is what keeps `locales` a tuple of literal types through
 * inference, so `Locale` derived from the result is `"en" | "pl"` rather than
 * `string` and `defaultLocale` is checked against the list beside it. Without
 * it every code widens to `string` and each app has to write `as const` on
 * every entry.
 */
export function buildConfig<const AppLocales extends LocaleConfig[]>(
  args: VitNodeConfig<AppLocales>,
): VitNodeConfig<AppLocales> {
  const config = {
    ...args,
    i18n: {
      ...args.i18n,
      localePrefix: args.i18n.localePrefix ?? "as-needed",
    },
  };

  // Register the app config so framework-owned modules - core's own route
  // screens and breadcrumbs among them - can read it without prop-drilling.
  registeredVitNodeConfig = config;

  return config;
}

/**
 * Builds the server-only companion to {@link buildConfig} - the one call in
 * `src/vitnode.server.config.ts`.
 *
 * Identity, deliberately: there is nothing to normalise, and the value of the
 * function is the type it pins and the file it names. Nothing registers it
 * process-wide either, because everything that reads it is already on the
 * server and can import it.
 */
export function buildServerConfig<const AppLocales extends LocaleConfig[]>(
  args: VitNodeServerConfig<AppLocales>,
): VitNodeServerConfig<AppLocales> {
  return args;
}

/**
 * Returns the app's VitNodeConfig registered by {@link buildConfig} (called once
 * in the app's `vitnode.config.ts`). Used by framework route files that need the
 * config but aren't passed it as a prop.
 */
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
