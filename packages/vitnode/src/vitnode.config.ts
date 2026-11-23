import type {
  AppMessagesMap,
  LocaleConfig,
  LocaleMessagesMap,
  VitNodeI18nConfig,
} from "@vitnode/api/lib/i18n/types";
import type { VitNodeMetadata } from "@vitnode/api/lib/metadata";
import type { PageCacheConfig } from "@vitnode/api/page-cache/config";

import type { VitNodeEditorConfig } from "./components/editor-provider";
import type { VitNodeLogo } from "./components/logo-context";
import type { ThemeProviderProps } from "./components/theme-provider";
import type { NavigationConfig } from "./lib/navigation";
import type { BuildPluginReturn } from "./lib/plugin";

import { assertNavigationConfig } from "./lib/navigation";

export type { LocaleConfig };

/**
 * An app's frontend configuration, written in `src/vitnode.config.ts` with
 * {@link buildConfig}. It reaches the browser, so it must not hold secrets;
 * server-only settings go in {@link VitNodeServerConfig} and, for the API,
 * `VitNodeApiConfig` from `@vitnode/api/vitnode.config`.
 */
export interface VitNodeConfig<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /**
   * Private chat in the site's UI. To turn chat off for the API too (routes,
   * emails), set `chat.enabled: false` in the API config as well.
   */
  chat?: VitNodeChatConfig;
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

/** Chat in the site's UI - `chat` in {@link VitNodeConfig}. */
export interface VitNodeChatConfig {
  /**
   * `false` docks nothing: the header's Chat button opens the `/chat` page on
   * every screen size instead of the chat window in the corner. Defaults to
   * `true`.
   */
  dock?: boolean;
  /**
   * `false` removes chat from the site: no Chat button, dock, Settings ->
   * Chat page or Chat buttons on profiles, `/chat` answers 404, and no page
   * asks the API for unread chats. Defaults to `true`.
   */
  enabled?: boolean;
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
