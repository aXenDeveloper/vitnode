import { describe, expect, it } from "vitest";

import {
  addLocaleToConfig,
  addMessagesToConfig,
  buildI18nFile,
} from "./i18n-create";

/** Narrows a transform's `string | null` result for the ordering assertions. */
const notNull = (value: null | string): string => {
  if (value === null) throw new Error("expected a transformed string");

  return value;
};

const withMessages = `import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

export const i18n = {
  defaultLocale: "en",
  locales: [
    { code: "en", name: "English" },
  ],
  messages: {
    pl: {
      "@vitnode/core": () => import("./locales/@vitnode/core/pl.json"),
    },
  },
} satisfies VitNodeI18nConfig;
`;

const withoutMessages = `import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

export const i18n = {
  defaultLocale: "en",
  locales: [
    { code: "en", name: "English" },
  ],
} satisfies VitNodeI18nConfig;
`;

describe("addLocaleToConfig", () => {
  it("prepends the new locale to the array", () => {
    const result = addLocaleToConfig(withMessages, {
      code: "de",
      name: "Deutsch",
    });

    expect(result).toContain('{ code: "de", name: "Deutsch" },');
    // The existing entry survives.
    expect(result).toContain('{ code: "en", name: "English" },');
    // New entry lands before the existing one in the array.
    const out = notNull(result);
    expect(out.indexOf('{ code: "de"')).toBeLessThan(
      out.indexOf('{ code: "en"'),
    );
  });

  it("returns null when there is no locales array", () => {
    expect(
      addLocaleToConfig("export const x = {};", { code: "de", name: "x" }),
    ).toBeNull();
  });
});

describe("addLocaleToConfig (inline array)", () => {
  const inline = `export const i18n = {
  defaultLocale: "en",
  locales: [{ code: "en", name: "English" }],
} satisfies VitNodeI18nConfig;
`;

  it("puts both entries on their own lines", () => {
    const out = notNull(
      addLocaleToConfig(inline, { code: "de", name: "Deutsch" }),
    );

    // No `},{` glue between the new and existing entry.
    expect(out).not.toContain("},{");
    expect(out).toContain('    { code: "de", name: "Deutsch" },\n');
    expect(out).toContain('{ code: "en", name: "English" }');
  });
});

describe("addMessagesToConfig", () => {
  it("closes an inline empty messages object onto its own line", () => {
    const inline = `export const i18n = {
  locales: [{ code: "en", name: "English" }],
  messages: {},
} satisfies VitNodeI18nConfig;
`;
    const out = notNull(
      addMessagesToConfig(inline, { code: "de", pluginIds: ["@vitnode/core"] }),
    );

    expect(out).not.toContain("},}");
    expect(out).toContain('"de": {');
    expect(out).toContain(
      '"@vitnode/core": () => import("./locales/@vitnode/core/de.json"),',
    );
  });

  it("extends an existing messages object", () => {
    const result = addMessagesToConfig(withMessages, {
      code: "de",
      pluginIds: ["@vitnode/blog", "@vitnode/core"],
    });

    expect(result).toContain('"de": {');
    expect(result).toContain(
      '"@vitnode/blog": () => import("./locales/@vitnode/blog/de.json"),',
    );
    // The previous `pl` block is untouched.
    expect(result).toContain("pl: {");
  });

  it("creates a messages block when none exists", () => {
    const result = addMessagesToConfig(withoutMessages, {
      code: "de",
      pluginIds: ["@vitnode/core"],
    });

    expect(result).toContain("messages: {");
    expect(result).toContain('"de": {');
    expect(result).toContain(
      '"@vitnode/core": () => import("./locales/@vitnode/core/de.json"),',
    );
    // Sits after the locales array, before the closing `satisfies`.
    const out = notNull(result);
    expect(out.indexOf("messages:")).toBeGreaterThan(out.indexOf("locales:"));
    expect(out.indexOf("messages:")).toBeLessThan(out.indexOf("satisfies"));
  });
});

describe("buildI18nFile", () => {
  it("renders every declared locale plus the new one", () => {
    const file = buildI18nFile({
      code: "de",
      defaultLocale: "en",
      locales: [{ code: "en", name: "English" }],
      name: "Deutsch",
      pluginIds: ["@vitnode/core"],
    });

    expect(file).toContain('defaultLocale: "en"');
    expect(file).toContain('{ code: "en", name: "English" },');
    expect(file).toContain('{ code: "de", name: "Deutsch" },');
    expect(file).toContain('"de": {');
    expect(file).toContain(
      '"@vitnode/core": () => import("./locales/@vitnode/core/de.json"),',
    );
    expect(file).toContain("satisfies VitNodeI18nConfig;");
  });
});
