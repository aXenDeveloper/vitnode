import type { ConfigEnv, UserConfig } from "vite";

import { describe, expect, it, vi } from "vitest";

import { vitNodeSsrExternals } from "./ssr-externals";

const externalsFor = async (
  command: ConfigEnv["command"],
  readPluginIds = vi.fn(async () =>
    Promise.resolve(["@acme/blog", "@acme/docs"]),
  ),
): Promise<{
  external: string[];
  nitro: undefined | { traceDeps: string[] };
  readPluginIds: typeof readPluginIds;
}> => {
  const plugin = vitNodeSsrExternals({ appRoot: "/app", readPluginIds });
  const config = plugin.config as (
    userConfig: UserConfig,
    env: ConfigEnv,
  ) => Promise<{
    nitro: undefined | { traceDeps: string[] };
    ssr: { external: string[] };
  }>;
  const { nitro, ssr } = await config({}, { command, mode: "development" });

  return { external: ssr.external, nitro, readPluginIds };
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

  it("keeps SimpleWebAuthn's server out of the Nitro bundle", async () => {
    const { nitro } = await externalsFor("build");

    expect(nitro?.traceDeps).toContain("@simplewebauthn/server");
  });

  it("leaves Nitro alone while the dev server runs", async () => {
    const { nitro } = await externalsFor("serve");

    expect(nitro).toBeUndefined();
  });
});
