import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import type { VitNodeMetadata } from "@/lib/metadata";
import type { SettingsNavKey } from "@/views/auth/settings/settings-nav";

import { formatPageTitle } from "@/lib/metadata";

import { intlQueryOptions } from "../i18n/query";

/**
 * What every settings route needs, in one place: the strings, the tab title.
 *
 * Its own module rather than a route's, because three routes and a breadcrumb
 * all read the namespace list and a route file importing another route file for
 * it would be a cycle. What is here is the part that is identical for every
 * panel; what a panel actually renders is the panel's own route.
 *
 * The navigation model itself is not here - `SETTINGS_NAV_ITEMS`,
 * `activeSettingsNavKey` and `isSettingsRootPath` live in
 * `@vitnode/core/views/auth/settings/settings-nav`, framework-free, because
 * Next.js reads them too. This namespace is only the part that needs a router
 * with a query cache in front of it.
 */

/**
 * What the settings screens render strings from.
 *
 * `core.auth.settings` is the heading, the description, the navigation and every
 * panel's own title - the same namespace the Next.js layout mounts, kept
 * deliberately: the panels are shared components and they look their strings up
 * by the same keys in both frameworks.
 *
 * `core.global` is listed even though a root provider already provides it,
 * because a per-route provider mounts its own over the root's rather than adding
 * to it - so a set that omitted it would take the global strings away from
 * everything below.
 *
 * One list, read by the loader that fetches it, by the provider that mounts it
 * and by the breadcrumb, because they have to be the same set or a reader
 * suspends on a key nobody warmed.
 */
export const SETTINGS_NAMESPACES = [
  "core.auth.settings",
  "core.global",
] as const;

/**
 * The branch of the message tree these routes read, named for
 * `createTranslator`.
 *
 * The cast this type serves: the translator's key type is derived from the
 * *inferred* type of `messages`, and `AbstractIntlMessages` is a bare index
 * signature - so `MessageKeys` cannot tell a leaf from a branch and collapses to
 * `never`, making every key a type error. Naming the keys these routes read is
 * both the smallest fix and a true statement: rename one in `locales/en.json`
 * and this stops compiling rather than rendering a raw message key into a
 * `<title>`.
 */
interface SettingsMessages {
  core: {
    auth: {
      settings: {
        desc: string;
        nav: { devices: string; overview: string; security: string };
        title: string;
      };
    };
  };
}

/** The narrowest slice of a settings route's context the loader below reads. */
export interface SettingsLoaderContext {
  locale: string;
  queryClient: QueryClient;
}

/**
 * The settings messages, as the one query definition every settings route
 * shares.
 *
 * The layout warms it, and so does each panel. The second call is a cache read
 * rather than a second request - same locale, same namespaces, therefore the
 * same key - and each panel asks anyway so that a panel's loader is complete on
 * its own terms rather than relying on the order its parent's happened to run
 * in.
 */
export const settingsMessagesQueryOptions = (locale: string) =>
  intlQueryOptions({ locale, namespaces: SETTINGS_NAMESPACES });

/** What a panel's loader returns, and therefore what its `head` receives. */
export interface SettingsPanelData {
  title: string;
}

/**
 * One panel's tab title, as `"<Panel> - <Settings>"`.
 *
 * The same two lookups the Next.js pages do - `nav.<key>` and `title` - so both
 * frameworks produce the same string, and `formatPageTitle` then appends the
 * site name exactly as Next.js does through `title.template`. Translated in the
 * loader rather than in `head`, which receives no router context and so cannot
 * resolve a locale at all.
 */
export const settingsPanelTitle = ({
  locale,
  messages,
  navKey,
}: {
  locale: string;
  messages: unknown;
  navKey: SettingsNavKey;
}): string => {
  const typed = messages as SettingsMessages;
  const t = createTranslator({
    locale,
    messages: typed,
    namespace: "core.auth.settings",
  });
  const tNav = createTranslator({
    locale,
    messages: typed,
    namespace: "core.auth.settings.nav",
  });

  return `${tNav(navKey)} - ${t("title")}`;
};

/**
 * The settings panel loader and `head`, bound to one host.
 *
 * A factory rather than two exported functions, because exactly one thing here
 * belongs to the application rather than to the feature: `metadata`, the site's
 * own name, which is configuration a package cannot own. The message transport
 * is not on that list any more - `intlQueryOptions` reads the runtime a host
 * registers through `configureIntl`, so loading the strings is this module's
 * job again.
 *
 * Everything else - which namespaces, which two message keys, what the title
 * reads, and the decision that a panel's `head` is a title and nothing else - is
 * here, so three panel routes and a breadcrumb cannot drift apart.
 */
/**
 * A settings panel's loader: warm the strings, translate its title.
 *
 * Every panel's loader is this and nothing else, until a panel has data of its
 * own to fetch - at which point it awaits this alongside its own read rather
 * than replacing it.
 *
 * Standalone, and it takes no metadata, because it needs none: a panel's *title*
 * is a translated string and the site name is appended later, by whichever
 * `head` renders it. {@link createSettingsPanel} re-exports this one rather than
 * carrying a second copy.
 */
export const loadSettingsPanel = async (
  context: SettingsLoaderContext,
  navKey: SettingsNavKey,
): Promise<SettingsPanelData> => {
  const intl = await context.queryClient.ensureQueryData(
    settingsMessagesQueryOptions(context.locale),
  );

  return {
    title: settingsPanelTitle({
      locale: context.locale,
      messages: intl.messages,
      navKey,
    }),
  };
};

export const createSettingsPanel = ({
  metadata,
}: {
  metadata: VitNodeMetadata;
}) => ({
  loadSettingsPanel,

  /**
   * A settings panel's `head`, which is a title and deliberately nothing else.
   *
   * `robots` is **not** here. The settings layout declares `noindex, nofollow`
   * once, and TanStack Start merges the `head` of every matched route - so the
   * whole subtree inherits it and a panel that restated it would be a second
   * copy to keep in step.
   *
   * `loaderData` is optional because the router types it so: it is `undefined`
   * while the route's loader is still pending, and a `head` that assumed
   * otherwise would throw during the first pass of a navigation.
   */
  settingsPanelHead: (loaderData?: SettingsPanelData) => ({
    meta: loaderData
      ? [{ title: formatPageTitle(metadata, loaderData.title) }]
      : [],
  }),
});

export type { SettingsNavKey };
export { SettingsLayoutContent } from "./layout";
/**
 * The panel bodies, re-exported so a route never has to reach past this
 * namespace to find one.
 *
 * They are the same modules the Next.js pages render and they contain no
 * TanStack at all, so a host *could* import them from `@vitnode/core/views/...`
 * directly - and two of its route files did. That is one feature with two entry
 * spellings, and only one of them is a spelling `boundary.test.ts` and
 * `package-boundary.test.ts` can police: a deep `views/` path resolves through
 * the package-wide `./*` pattern, where nothing checks what a route is allowed
 * to reach for. Re-exporting them here makes `@vitnode/core/tanstack/settings`
 * the whole of what a settings route imports.
 *
 * `DevicesPanelContent` is deliberately not among them - it owns a query, so it
 * lives in `@vitnode/core/tanstack/devices` beside the query options its route's
 * loader has to warm.
 */
export { OverviewSettings } from "@/views/auth/settings/overview/overview";
export { SecuritySettings } from "@/views/auth/settings/security/security";
/**
 * The settings trail. A host binds its own link component to it - during a
 * migration that is not a plain `<Link>` - and mounts the result as the
 * subtree's `staticData.breadcrumb`.
 */
export type { SettingsBreadcrumbContentProps } from "@/views/auth/settings/settings-breadcrumb-content";
export { SettingsBreadcrumbContent } from "@/views/auth/settings/settings-breadcrumb-content";
export {
  activeSettingsNavKey,
  isSettingsNavItemActive,
  isSettingsRootPath,
  SETTINGS_NAV_ITEMS,
  SETTINGS_ROOT_HREF,
  settingsNavHref,
} from "@/views/auth/settings/settings-nav";
