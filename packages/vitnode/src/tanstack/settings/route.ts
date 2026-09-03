import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import type { VitNodeMetadata } from "@/lib/metadata";
import type { SettingsNavKey } from "@/views/auth/settings/settings-nav";

import { formatPageTitle } from "@/lib/metadata";

import { intlQueryOptions } from "../i18n/query";

export const SETTINGS_NAMESPACES = [
  "core.auth.settings",
  "core.global",
] as const;

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

export const settingsMessagesQueryOptions = (locale: string) =>
  intlQueryOptions({ locale, namespaces: SETTINGS_NAMESPACES });

/** What a panel's loader returns, and therefore what its `head` receives. */
export interface SettingsPanelData {
  title: string;
}

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
