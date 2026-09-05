import { createJiti } from "jiti";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { pluginIdsFromLoadedConfig } from "../plugin-routes";

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
