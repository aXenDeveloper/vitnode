import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it } from "vitest";

import { CONFIG_PLUGIN } from "@/config";
import { loadMessages, resetMessagesCache } from "@/lib/i18n/load-messages";
import { buildMessagesSources } from "@/lib/i18n/sources";

import { buildSearchText, matchesAdminNavItem } from "./flatten-nav";

const buildTranslator = async (locale: string) => {
  const messages = await loadMessages({
    defaultLocale: "en",
    locale,
    sources: buildMessagesSources({
      appMessages: {
        pl: {
          [CONFIG_PLUGIN.pluginId]: async () =>
            Promise.resolve({
              default: {
                admin: {
                  global: {
                    nav: {
                      core: "Rdzeń",
                      user_bar: { debug: "Panel debugowania" },
                      users: {
                        list: "Lista użytkowników",
                        roles: "Role",
                        title: "Użytkownicy",
                      },
                    },
                  },
                },
              },
            }),
        },
      },
      plugins: [],
    }),
  });

  return createTranslator({ locale, messages });
};

describe("multi-locale nav titles", () => {
  beforeEach(() => {
    resetMessagesCache();
  });

  it("resolves a non-active locale's titles", async () => {
    const t = await buildTranslator("pl");

    // @ts-expect-error - the test's inline tree is not the augmented `Messages`.
    expect(t("admin.global.nav.users.roles")).toBe("Role");
    // @ts-expect-error - see above.
    expect(t("admin.global.nav.core")).toBe("Rdzeń");
  });

  it("resolves the debug panel, which sits outside the sidebar nav", async () => {
    const key = "admin.global.nav.user_bar.debug";
    const [en, pl] = await Promise.all([
      buildTranslator("en"),
      buildTranslator("pl"),
    ]);

    // @ts-expect-error - the test's inline tree is not the augmented `Messages`.
    expect(en(key)).toBe("Debug Panel");
    // @ts-expect-error - see above.
    expect(pl(key)).toBe("Panel debugowania");

    const item = {
      groupTitle: "Rdzeń",
      href: "/admin/core/debug",
      // @ts-expect-error - see above.
      searchText: buildSearchText([pl(key), en(key), "Rdzeń", "Core"]),
      // @ts-expect-error - see above.
      title: pl(key),
    };

    expect(matchesAdminNavItem(item, "debug")).toBe(true);
    expect(matchesAdminNavItem(item, "panel debugowania")).toBe(true);
    expect(matchesAdminNavItem(item, "debug panel")).toBe(true);
  });

  it("falls back to the default locale key by key", async () => {
    const t = await buildTranslator("pl");

    // Not translated above, so English shows through rather than a raw key.
    // @ts-expect-error - see above.
    expect(t("admin.global.nav.dashboard")).toBe("Dashboard");
  });

  it("still resolves English when that is the locale asked for", async () => {
    const t = await buildTranslator("en");

    // @ts-expect-error - see above.
    expect(t("admin.global.nav.users.roles")).toBe("Roles");
  });

  it("finds a Polish-labelled row by its English title", async () => {
    const [pl, en] = await Promise.all([
      buildTranslator("pl"),
      buildTranslator("en"),
    ]);
    const key = "admin.global.nav.users.roles";
    const parentKey = "admin.global.nav.users.title";

    const item = {
      groupTitle: "Rdzeń",
      href: "/admin/core/users/roles",
      // What `getSearchNavItems` merges: the active locale's strings plus every
      // other locale's, so either language finds the row.
      searchText: buildSearchText([
        // @ts-expect-error - see above.
        pl(key),
        // @ts-expect-error - see above.
        pl(parentKey),
        // @ts-expect-error - see above.
        en(key),
        // @ts-expect-error - see above.
        en(parentKey),
      ]),
      // @ts-expect-error - see above.
      title: pl(key),
    };

    expect(item.title).toBe("Role");
    // The regression this whole feature exists for: "Role" alone does not
    // contain "roles", so a single-locale haystack would miss it.
    expect(item.searchText).not.toBe("role użytkownicy");
    expect(matchesAdminNavItem(item, "roles")).toBe(true);
    expect(matchesAdminNavItem(item, "role")).toBe(true);
    expect(matchesAdminNavItem(item, "users")).toBe(true);
    expect(matchesAdminNavItem(item, "użytkownicy")).toBe(true);
    expect(matchesAdminNavItem(item, "nope")).toBe(false);
  });
});
