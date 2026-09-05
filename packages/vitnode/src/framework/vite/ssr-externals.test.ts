import type { ConfigEnv, UserConfig } from "vite";

import { describe, expect, it, vi } from "vitest";

import { vitNodeSsrExternals } from "./ssr-externals";

const externalsFor = async (
  command: ConfigEnv["command"],
  readPluginIds = vi.fn(async () =>
    Promise.resolve(["@acme/blog", "@acme/docs"]),
  ),
): Promise<{ external: string[]; readPluginIds: typeof readPluginIds }> => {
  const plugin = vitNodeSsrExternals({ appRoot: "/app", readPluginIds });
  const config = plugin.config as (
    userConfig: UserConfig,
    env: ConfigEnv,
  ) => Promise<{ ssr: { external: string[] } }>;
  const { ssr } = await config({}, { command, mode: "development" });

  return { external: ssr.external, readPluginIds };
};

describe("what a VitNode app externalises from its SSR pass", () => {
  it("externalises the package and every configured plugin for the build", async () => {
    const { external } = await externalsFor("build");

    expect(external).toEqual([
      "@vitnode/core",
      "@acme/blog",
      "@acme/docs",
      "tslib",
    ]);
  });

  it("keeps the packages inlined while the dev server runs", async () => {
    const { external } = await externalsFor("serve");

    expect(external).toEqual(["tslib"]);
  });

  it("does not read the app's config to answer the dev question", async () => {
    const { readPluginIds } = await externalsFor("serve");

    expect(readPluginIds).not.toHaveBeenCalled();
  });

  it("reads the configured plugins from the app root it was given", async () => {
    const { readPluginIds } = await externalsFor("build");

    expect(readPluginIds).toHaveBeenCalledWith("/app");
  });
});
