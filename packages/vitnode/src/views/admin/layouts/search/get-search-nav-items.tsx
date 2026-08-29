import { createTranslator } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "server-only";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { VitNodeConfig } from "@/vitnode.config";

import { EMPTY_STAFF_PERMISSION_SET } from "@/api/lib/staff-permission";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { loadMessages } from "@/lib/i18n/load-messages";
import { buildMessagesSources } from "@/lib/i18n/sources";

import type { AdminNavTranslator } from "../sidebar/nav/nav-model";
import type { NavAdminParent } from "../sidebar/nav/nav-model";
import type { AdminSearchNavItem } from "./flatten-nav";

import { normalizeUrl } from "../normalize-url";
import { getAdminNav } from "../sidebar/nav/get-admin-nav";
import { buildSearchText, flattenAdminNav } from "./flatten-nav";
import { adminSearchOnlyItems } from "./search-only-pages";

/**
 * The AdminCP command palette's index, for Next.js.
 *
 * The palette is the navigation, flattened - so an entry is findable only if it
 * survived the permission filter - plus the handful of real pages deliberately
 * kept out of the sidebar, each gated on its own permission. Both halves are the
 * shared model's (`flattenAdminNav`, `adminSearchOnlyItems`); what is here is
 * the part that needs a server.
 *
 * ## Every enabled language, not just the active one
 *
 * The whole tree is resolved once per enabled locale and the results are merged
 * into each item's `searchText`, so an admin reading Polish can still find
 * "Users" by typing its English name - which is what somebody who learned the
 * panel in one language and switched actually does. Only the *text* is merged;
 * the titles rendered stay the active locale's.
 */

const getEnabledLocales = (vitNodeConfig: VitNodeConfig): string[] =>
  vitNodeConfig.i18n.locales
    .filter(locale => locale.enabled !== false)
    .map(locale => locale.code);

const getItemsForLocale = async ({
  locale,
  permissions,
  vitNodeConfig,
}: {
  locale: string;
  permissions: StaffPermissionSet;
  vitNodeConfig: VitNodeConfig;
}): Promise<AdminSearchNavItem[]> => {
  const messages = await loadMessages({
    defaultLocale: vitNodeConfig.i18n.defaultLocale,
    locale,
    sources: buildMessagesSources({
      appMessages: vitNodeConfig.i18n.messages,
      plugins: vitNodeConfig.plugins,
    }),
  });
  const translator = createTranslator({
    locale,
    messages,
  }) as unknown as AdminNavTranslator;

  return [
    ...flattenAdminNav(await getAdminNav({ translator, vitNodeConfig })),
    ...adminSearchOnlyItems({ permissions, t: translator }),
  ];
};

export const getSearchNavItems = async ({
  nav,
  vitNodeConfig,
}: {
  nav: NavAdminParent[];
  vitNodeConfig: VitNodeConfig;
}): Promise<AdminSearchNavItem[]> => {
  const session = await getSessionAdminApi();
  const permissions = session?.permissions ?? EMPTY_STAFF_PERMISSION_SET;
  const activeTranslator =
    (await getTranslations()) as unknown as AdminNavTranslator;
  const items = [
    ...flattenAdminNav(nav),
    ...adminSearchOnlyItems({ permissions, t: activeTranslator }),
  ];
  const activeLocale = await getLocale();
  const otherLocales = getEnabledLocales(vitNodeConfig).filter(
    locale => locale !== activeLocale,
  );

  if (!otherLocales.length) return items;

  const translated = await Promise.all(
    otherLocales.map(
      async locale =>
        await getItemsForLocale({ locale, permissions, vitNodeConfig }),
    ),
  );

  const textByHref = new Map<string, string[]>();
  for (const list of [items, ...translated]) {
    for (const item of list) {
      const key = normalizeUrl(item.href);
      textByHref.set(key, [
        ...(textByHref.get(key) ?? []),
        item.title,
        item.parentTitle ?? "",
        item.groupTitle,
      ]);
    }
  }

  return items.map(item => ({
    ...item,
    searchText: buildSearchText(textByHref.get(normalizeUrl(item.href)) ?? []),
  }));
};
