import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Messages, MessagesSource } from "./types";

import {
  collectLocaleCodes,
  loadMessages,
  resetMessagesCache,
} from "./load-messages";

const source = (
  id: string,
  messages: Record<string, Messages>,
  optional = false,
): MessagesSource => ({
  id,
  messages: Object.fromEntries(
    Object.entries(messages).map(([locale, value]) => [
      locale,
      async () => await Promise.resolve({ default: value }),
    ]),
  ),
  optional,
});

describe("loadMessages", () => {
  beforeEach(() => {
    resetMessagesCache();
    vi.restoreAllMocks();
  });

  it("merges core, plugins and app overrides in order", async () => {
    const messages = await loadMessages({
      defaultLocale: "en",
      locale: "en",
      sources: [
        source("@vitnode/core", { en: { core: { save: "Save" } } }),
        source("@vitnode/blog", { en: { "@vitnode/blog": { title: "Blog" } } }),
        source("app:@vitnode/core", { en: { core: { save: "Store" } } }, true),
      ],
    });

    expect(messages).toEqual({
      "@vitnode/blog": { title: "Blog" },
      core: { save: "Store" },
    });
  });

  it("falls back to the default locale key by key", async () => {
    const messages = await loadMessages({
      defaultLocale: "en",
      locale: "pl",
      sources: [
        source("@vitnode/core", {
          en: { core: { cancel: "Cancel", save: "Save" } },
          pl: { core: { save: "Zapisz" } },
        }),
      ],
    });

    expect(messages).toEqual({ core: { cancel: "Cancel", save: "Zapisz" } });
  });

  it("returns the default locale when nothing ships the requested one", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const messages = await loadMessages({
      defaultLocale: "en",
      locale: "de",
      sources: [source("@vitnode/core", { en: { core: { save: "Save" } } })],
    });

    expect(messages).toEqual({ core: { save: "Save" } });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("warns once and keeps going when a loader throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sources: MessagesSource[] = [
      source("@vitnode/core", { en: { core: { save: "Save" } } }),
      {
        id: "@vitnode/blog",
        messages: {
          en: async () => await Promise.reject(new Error("not bundled")),
          pl: async () =>
            await Promise.resolve({ default: { "@vitnode/blog": "Wpisy" } }),
        },
      },
    ];

    expect(
      await loadMessages({ defaultLocale: "en", locale: "en", sources }),
    ).toEqual({ core: { save: "Save" } });
    expect(warn).toHaveBeenCalledOnce();

    // A different locale re-reads the broken `en` file as the fallback base,
    // but the warning has already been said once.
    await loadMessages({ defaultLocale: "en", locale: "pl", sources });

    expect(warn).toHaveBeenCalledOnce();
  });

  it("does not warn about an app override missing the default locale", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await loadMessages({
      defaultLocale: "en",
      locale: "en",
      sources: [
        source("@vitnode/core", { en: { core: { save: "Save" } } }),
        source("app:@vitnode/core", { pl: { core: { save: "Zapisz" } } }, true),
      ],
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps scopes apart when sources share ids (single-app case)", async () => {
    // Same id, different tree - exactly a plugin's web vs api barrels in one
    // process. The cache must not hand the second caller the first's tree.
    const api: MessagesSource = {
      ...source("@vitnode/core", { en: { core: { subject: "Reset" } } }),
      scope: "api",
    };
    const web: MessagesSource = {
      ...source("@vitnode/core", { en: { core: { save: "Save" } } }),
      scope: "web",
    };

    const apiTree = await loadMessages({
      defaultLocale: "en",
      locale: "en",
      sources: [api],
    });
    const webTree = await loadMessages({
      defaultLocale: "en",
      locale: "en",
      sources: [web],
    });

    expect(apiTree).toEqual({ core: { subject: "Reset" } });
    expect(webTree).toEqual({ core: { save: "Save" } });
  });

  it("loads each locale only once in production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const loader = vi.fn(
        async () =>
          await Promise.resolve({ default: { core: { save: "Save" } } }),
      );
      const sources: MessagesSource[] = [
        { id: "@vitnode/core", messages: { en: loader } },
      ];

      await loadMessages({ defaultLocale: "en", locale: "en", sources });
      await loadMessages({ defaultLocale: "en", locale: "en", sources });

      expect(loader).toHaveBeenCalledOnce();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("re-reads on every call outside production, so edits show up live", async () => {
    // vitest runs with NODE_ENV=test, i.e. the cache is off - the same path dev
    // takes. A second call must hit the loader again rather than a stale tree.
    const loader = vi.fn(
      async () =>
        await Promise.resolve({ default: { core: { save: "Save" } } }),
    );
    const sources: MessagesSource[] = [
      { id: "@vitnode/core", messages: { en: loader } },
    ];

    await loadMessages({ defaultLocale: "en", locale: "en", sources });
    await loadMessages({ defaultLocale: "en", locale: "en", sources });

    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("collectLocaleCodes", () => {
  it("returns the sorted union of every source's locales", () => {
    expect(
      collectLocaleCodes([
        source("@vitnode/core", { en: {}, pl: {} }),
        source("@vitnode/blog", { de: {}, en: {} }),
        { id: "@vitnode/empty" },
      ]),
    ).toEqual(["de", "en", "pl"]);
  });
});
