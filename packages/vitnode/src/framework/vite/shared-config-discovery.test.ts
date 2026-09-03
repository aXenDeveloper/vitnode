import { createJiti } from "jiti";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { pluginIdsFromLoadedConfig } from "../plugin-routes";

/**
 * How the build finds out which plugins an app configured.
 *
 * The generator loads `src/vitnode.config.ts` with `jiti` while Vite is still
 * resolving its own config, reads `plugins[].pluginId`, and generates one
 * literal import per plugin into three committed files. That is the entire
 * contract, and the property worth pinning is what it must *not* need: the
 * app's message loaders, its React content registries, or anything else that
 * only makes sense on a server.
 *
 * `test-fixtures/config-split/` is a config pair exactly as an app writes one,
 * except that its server half throws at module scope. So a discovery pass that
 * reached the wrong file fails here rather than becoming a slow build somebody
 * eventually profiles.
 */
const fixtureRoot = resolve(
  import.meta.dirname,
  "../../../test-fixtures/config-split",
);
const sharedConfig = join(fixtureRoot, "vitnode.config.ts");
const serverConfig = join(fixtureRoot, "vitnode.server.config.ts");

/** The loader the generator uses, with the same options. */
const load = async (path: string): Promise<unknown> =>
  await createJiti(pathToFileURL(join(fixtureRoot, "package.json")).href, {
    interopDefault: true,
    moduleCache: false,
  }).import(path);

describe("the shared config is browser-safe and build-time cheap", () => {
  it("discovers every configured plugin id, in configuration order", async () => {
    expect(
      pluginIdsFromLoadedConfig(await load(sharedConfig), "vitnode.config.ts"),
    ).toEqual(["@acme/blog", "@acme/docs"]);
  });

  it("loads without touching the server-only config", async () => {
    // The claim. If `vitnode.config.ts` ever imports its server companion -
    // directly, or through a `locales/` barrel that does - this is the assertion
    // that goes red.
    await expect(load(sharedConfig)).resolves.toBeDefined();
  });

  it("would have noticed - the server-only config really does throw", async () => {
    // The control: the assertion above would also pass against a fixture whose
    // server half was importable.
    await expect(load(serverConfig)).rejects.toThrow(
      "the server-only config was loaded",
    );
  });

  it("carries the locale declaration the rest of the app reads", async () => {
    const { vitNodeConfig } = (await load(sharedConfig)) as {
      vitNodeConfig: {
        i18n: { defaultLocale: string; locales: { code: string }[] };
      };
    };

    expect(vitNodeConfig.i18n.defaultLocale).toBe("en");
    expect(vitNodeConfig.i18n.locales.map(locale => locale.code)).toEqual([
      "en",
      "pl",
    ]);
  });
});
