// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  localeFilesFromDeclaration,
  resolvePackageMessagesModules,
} from "./resolve.js";

const WHERE = "`vitNodeConfig.plugins[0].localeFiles` in src/vitnode.config.ts";

describe("localeFilesFromDeclaration", () => {
  it("accepts a manifest of package subpaths", () => {
    expect(
      localeFilesFromDeclaration(
        {
          en: "@acme/blog/locales/en.json",
          "pt-BR": "@acme/blog/i18n/br.json",
        },
        WHERE,
      ),
    ).toEqual({
      en: "@acme/blog/locales/en.json",
      "pt-BR": "@acme/blog/i18n/br.json",
    });
  });

  it("sorts by locale code, so the reader is deterministic too", () => {
    expect(
      Object.keys(
        localeFilesFromDeclaration(
          {
            pl: "@acme/blog/locales/pl.json",
            de: "@acme/blog/locales/de.json",
            en: "@acme/blog/locales/en.json",
          },
          WHERE,
        ) ?? {},
      ),
    ).toEqual(["de", "en", "pl"]);
  });

  /** Most plugins ship no translations, and that is not a misconfiguration. */
  it.each([undefined, {}])("treats %j as no manifest at all", value => {
    expect(localeFilesFromDeclaration(value, WHERE)).toBeUndefined();
  });

  it.each([null, [], "@acme/blog/locales/en.json", 1])(
    "rejects %j, which is not a manifest",
    value => {
      expect(() => localeFilesFromDeclaration(value, WHERE)).toThrow(
        /is not an object/,
      );
    },
  );

  it.each(["../evil", "en/US", "en.json", "", "en json"])(
    "rejects %j as a locale code",
    code => {
      expect(() =>
        localeFilesFromDeclaration(
          { [code]: "@acme/blog/locales/en.json" },
          WHERE,
        ),
      ).toThrow(/is not a locale code/);
    },
  );

  it("names the locale whose value is not a string", () => {
    expect(() => localeFilesFromDeclaration({ en: () => null }, WHERE)).toThrow(
      /localeFiles` in src\/vitnode\.config\.ts\.en is not a string/,
    );
  });

  it.each([
    ["./locales/en.json", "a path relative to the plugin"],
    ["../blog/locales/en.json", "a path that climbs out"],
    ["@acme/blog/../../etc/passwd.json", "a traversing subpath"],
    ["@acme/blog/locales/en", "a specifier that is not JSON"],
    ["@acme/blog", "a bare package with no file"],
    ["/abs/locales/en.json", "an absolute path"],
    ["https://cdn.example.com/en.json", "a URL"],
  ])("rejects %j - %s", specifier => {
    expect(() => localeFilesFromDeclaration({ en: specifier }, WHERE)).toThrow(
      /is not a package's `\*\.json` subpath/,
    );
  });

  /**
   * A JavaScript object cannot hold the same key twice, so the duplicate that
   * can actually reach here is the one a lookup would fold together.
   */
  it("rejects one locale declared twice under different casing", () => {
    expect(() =>
      localeFilesFromDeclaration(
        { en: "@acme/blog/locales/en.json", EN: "@acme/blog/locales/EN.json" },
        WHERE,
      ),
    ).toThrow(/declares the locale "en" twice/);
  });
});

describe("resolvePackageMessagesModules", () => {
  const blog = {
    localeFiles: { en: "@acme/blog/locales/en.json" },
    pluginId: "@acme/blog",
  };
  const quiet = { pluginId: "@acme/quiet" };

  it("keeps only the plugins that declare locale files", () => {
    expect(
      resolvePackageMessagesModules([quiet, blog], "src/vitnode.config.ts"),
    ).toEqual([blog]);
  });

  it("accepts an app with no plugins", () => {
    expect(resolvePackageMessagesModules([], "src/vitnode.config.ts")).toEqual(
      [],
    );
  });

  it("orders by plugin id rather than by configuration order", () => {
    expect(
      resolvePackageMessagesModules(
        [
          {
            localeFiles: { en: "@acme/zebra/locales/en.json" },
            pluginId: "@acme/zebra",
          },
          blog,
        ],
        "src/vitnode.config.ts",
      ).map(module => module.pluginId),
    ).toEqual(["@acme/blog", "@acme/zebra"]);
  });

  it("compares code units rather than using the machine's collation", () => {
    expect(
      resolvePackageMessagesModules(
        [
          {
            localeFiles: { en: "a-plugin/locales/en.json" },
            pluginId: "a-plugin",
          },
          {
            localeFiles: { en: "B-plugin/locales/en.json" },
            pluginId: "B-plugin",
          },
        ],
        "src/vitnode.config.ts",
      ).map(module => module.pluginId),
    ).toEqual(["B-plugin", "a-plugin"]);
  });

  it("rejects the same plugin configured twice", () => {
    expect(() =>
      resolvePackageMessagesModules([blog, blog], "src/vitnode.config.ts"),
    ).toThrow(/configures "@acme\/blog" twice/);
  });

  /** Even when neither registration is the one that ships the translations. */
  it("rejects a duplicate that declares no locale files either", () => {
    expect(() =>
      resolvePackageMessagesModules([quiet, quiet], "src/vitnode.config.ts"),
    ).toThrow(/configures "@acme\/quiet" twice/);
  });

  it("refuses a plugin that claims core's own id", () => {
    expect(() =>
      resolvePackageMessagesModules(
        [
          {
            localeFiles: { en: "@acme/blog/locales/en.json" },
            pluginId: "@vitnode/core",
          },
        ],
        "src/vitnode.config.ts",
      ),
    ).toThrow(/claims the id "@vitnode\/core"/);
  });
});
