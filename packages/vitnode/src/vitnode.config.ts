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
import type { ProgressBarConfig } from "./components/progress-bar";
import type { ThemeProviderProps } from "./components/theme-provider";
import type { DefaultTemplateEmailProps } from "./emails/default-template";
import type {
  LocaleConfig,
  VitNodeApiI18nConfig,
  VitNodeI18nConfig,
} from "./lib/i18n/types";
import type { VitNodeMetadata } from "./lib/metadata";
import type { BuildPluginReturn } from "./lib/plugin";

export type { LocaleConfig };

export interface VitNodeConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  debug?: boolean;
  i18n: VitNodeI18nConfig<AppLocales>;
  metadata: VitNodeMetadata;
  plugins: BuildPluginReturn[];
  progressBar?: ProgressBarConfig;
  theme?: Omit<
    ThemeProviderProps,
    "attribute" | "children" | "disableTransitionOnChange" | "enableSystem"
  >;
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
     * Defaults to `[NEXT_PUBLIC_WEB_URL]`, which is right for the usual one-web
     * app install. Set it when one API serves several front ends: each origin
     * owns its own Next cache, and each is posted independently.
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
      "VitNode config not initialized - ensure `buildConfig` runs in your vitnode.config.ts.",
    );
  }

  return registeredVitNodeConfig;
};

export function buildApiConfig(args: VitNodeApiConfig): VitNodeApiConfig {
  return args;
}
