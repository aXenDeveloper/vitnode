// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { VitNodeConfig } from "@/vitnode.config";

vi.mock("@tanstack/react-start/server-only", () => ({}));

const { buildConfig, buildServerConfig } = await import("@/vitnode.config");
const { createIntlMessagesLoader } = await import("./messages");

const messages = (tree: Record<string, unknown>) => async () =>
  await Promise.resolve({ default: tree });

const config: VitNodeConfig = buildConfig({
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", name: "English" },
      { code: "pl", name: "Polski" },
    ],
  },
  metadata: { shortTitle: "Fixture", title: "Fixture" },
  plugins: [{ pluginId: "@acme/blog" }],
});

const serverConfig = buildServerConfig({
  config,
  messages: {
    pl: { "@acme/blog": messages({ blog: { title: "Nasz blog" } }) },
  },
  packageMessages: {
    "@acme/blog": {
      en: messages({ blog: { author: "Author", title: "Blog" } }),
      pl: messages({ blog: { title: "Blog (pakiet)" } }),
    },
    "@vitnode/core": { en: messages({ core: { global: { save: "Save" } } }) },
  },
});

const load = createIntlMessagesLoader(serverConfig);

describe("a server config resolves messages against the shared locale list", () => {
  it("reads the plugins the shared config registered", async () => {
    const { messages: tree } = await load({
      locale: "en",
      namespaces: ["blog"],
    });

    expect(tree).toEqual({ blog: { author: "Author", title: "Blog" } });
  });

  it("merges the app's own overrides last", async () => {
    const { messages: tree } = await load({
      locale: "pl",
      namespaces: ["blog"],
    });

    expect(tree).toEqual({
      // The app's rewording wins over the plugin's own Polish...
      blog: { author: "Author", title: "Nasz blog" },
    });
  });

  it("falls back to the shared config's defaultLocale key by key", async () => {
    // ...and `author`, which nothing translated to Polish, comes from `en`
    // rather than rendering as its own key. `defaultLocale` is read off the
    // shared half, which is the join these two files exist to make.
    const { messages: tree } = await load({
      locale: "pl",
      namespaces: ["blog"],
    });

    expect((tree as { blog: { author: string } }).blog.author).toBe("Author");
  });

  it("picks only the namespaces a page asked for", async () => {
    const { messages: tree } = await load({
      locale: "en",
      namespaces: ["core.global"],
    });

    expect(tree).toEqual({ core: { global: { save: "Save" } } });
  });

  it("is the same loader the four spelled-out options build", async () => {
    const explicit = createIntlMessagesLoader({
      appMessages: serverConfig.messages,
      defaultLocale: config.i18n.defaultLocale,
      packageMessages: serverConfig.packageMessages ?? {},
      plugins: config.plugins,
    });

    expect(await explicit({ locale: "pl", namespaces: ["blog"] })).toEqual(
      await load({ locale: "pl", namespaces: ["blog"] }),
    );
  });

  it("needs no loaders at all", async () => {
    // An app that overrides nothing and installs nothing still has to render.
    const bare = createIntlMessagesLoader(buildServerConfig({ config }));

    expect(await bare({ locale: "en", namespaces: ["blog"] })).toEqual({
      locale: "en",
      messages: {},
    });
  });
});
