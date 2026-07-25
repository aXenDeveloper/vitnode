import { describe, expect, it } from "vitest";

import {
  removeLocaleFromConfig,
  removeMessagesFromConfig,
} from "./i18n-delete";

const config = `import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

export const i18n = {
  defaultLocale: "en",
  locales: [
    { code: "de", name: "Deutsch" },
    { code: "en", name: "English" },
    { code: "pl", name: "Polski" },
  ],
  messages: {
    de: {
      "@vitnode/blog": () => import("./locales/@vitnode/blog/de.json"),
      "@vitnode/core": () => import("./locales/@vitnode/core/de.json"),
    },
    pl: {
      "@vitnode/core": () => import("./locales/@vitnode/core/pl.json"),
    },
  },
} satisfies VitNodeI18nConfig;
`;

describe("removeLocaleFromConfig", () => {
  it("drops the matching locale and leaves the others", () => {
    const out = removeLocaleFromConfig(config, "de");

    expect(out).not.toContain('{ code: "de", name: "Deutsch" }');
    expect(out).toContain('{ code: "en", name: "English" },');
    expect(out).toContain('{ code: "pl", name: "Polski" },');
  });

  it("only matches an exact code, not a prefix", () => {
    const withRegion = config.replace(
      '{ code: "de", name: "Deutsch" },',
      '{ code: "de", name: "Deutsch" },\n    { code: "de-AT", name: "Austrian" },',
    );
    const out = removeLocaleFromConfig(withRegion, "de");

    // The region variant survives when we delete plain `de`.
    expect(out).toContain('{ code: "de-AT", name: "Austrian" },');
    expect(out).not.toContain('{ code: "de", name: "Deutsch" }');
  });

  it("returns the source unchanged for an unknown code", () => {
    expect(removeLocaleFromConfig(config, "fr")).toBe(config);
  });
});

describe("removeMessagesFromConfig", () => {
  it("drops the matching messages block and keeps the rest", () => {
    const out = removeMessagesFromConfig(config, "de");

    expect(out).not.toContain(
      '"@vitnode/blog": () => import("./locales/@vitnode/blog/de.json")',
    );
    // The `pl` block is untouched.
    expect(out).toContain("pl: {");
    expect(out).toContain(
      '"@vitnode/core": () => import("./locales/@vitnode/core/pl.json"),',
    );
  });

  it("returns the source unchanged when the locale has no block", () => {
    // `de` is declared but imagine only its files exist, not a messages block.
    const noBlock = removeMessagesFromConfig(config, "de");
    expect(removeMessagesFromConfig(noBlock, "de")).toBe(noBlock);
  });
});

describe("remove then the config still parses as expected", () => {
  it("fully unwires a locale", () => {
    const out = removeMessagesFromConfig(
      removeLocaleFromConfig(config, "de"),
      "de",
    );

    expect(out).not.toContain('"de"');
    expect(out).not.toContain("Deutsch");
    expect(out).toContain('{ code: "en", name: "English" },');
    expect(out).toContain("pl: {");
  });
});
