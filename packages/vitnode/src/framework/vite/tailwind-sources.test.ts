import type { Plugin } from "vite";

import { describe, expect, it, vi } from "vitest";

import { vitNodeTailwindSources } from "./tailwind-sources";

const APP_CSS = '@import "tailwindcss";\n@import "./theme.css";\n';

type TransformHook = (
  code: string,
  id: string,
) => null | { code: string; map: null };

const installed = (appRoot: string, packageName: string): null | string =>
  `${appRoot}/node_modules/${packageName}/dist/src`;

const prepared = async ({
  readBuildOutput = installed,
  readPluginIds = vi.fn(async () => Promise.resolve(["@acme/blog"])),
  stylesheets = {},
}: {
  readBuildOutput?: (appRoot: string, packageName: string) => null | string;
  readPluginIds?: () => Promise<string[]>;
  stylesheets?: Record<string, string>;
} = {}): Promise<{ plugin: Plugin; transform: TransformHook }> => {
  const plugin = vitNodeTailwindSources({
    appRoot: "/app",
    readBuildOutput,
    readPluginIds,
    readStylesheet: path => stylesheets[path] ?? null,
  });

  await (plugin.configResolved as () => Promise<void>)();

  return { plugin, transform: plugin.transform as TransformHook };
};

const sourcesIn = (code: string): string[] =>
  [...code.matchAll(/@source "([^"]+)";/g)].map(match => match[1]);

describe("the Tailwind sources a VitNode app scans", () => {
  it("scans the package and every configured plugin", async () => {
    const { transform } = await prepared();

    expect(
      sourcesIn(transform(APP_CSS, "/app/src/styles.css")?.code ?? ""),
    ).toEqual([
      "/app/node_modules/@vitnode/core/dist/src/**/*.js",
      "/app/node_modules/@acme/blog/dist/src/**/*.js",
    ]);
  });

  it("scans a package's whole build output rather than named directories", async () => {
    const { transform } = await prepared();

    for (const source of sourcesIn(
      transform(APP_CSS, "/app/src/styles.css")?.code ?? "",
    )) {
      expect(source).toMatch(/\/dist\/src\/\*\*\/\*\.js$/);
    }
  });

  it("keeps the stylesheet it was given", async () => {
    const { transform } = await prepared();

    expect(transform(APP_CSS, "/app/src/styles.css")?.code).toContain(APP_CSS);
  });

  it("leaves a stylesheet that does not import Tailwind alone", async () => {
    const { transform } = await prepared();

    expect(
      transform('@import "./theme.css";', "/app/src/theme.css"),
    ).toBeNull();
  });

  it("scans the same sources for a route stylesheet built on the app one", async () => {
    const { transform } = await prepared({
      stylesheets: { "/app/src/styles.css": APP_CSS },
    });

    expect(
      sourcesIn(
        transform(
          '@import "../styles.css";\n@import "fumadocs-ui/css/preset.css";\n',
          "/app/src/docs/docs.css",
        )?.code ?? "",
      ),
    ).toEqual([
      "/app/node_modules/@vitnode/core/dist/src/**/*.js",
      "/app/node_modules/@acme/blog/dist/src/**/*.js",
    ]);
  });

  it("follows a chain of relative imports to the Tailwind one", async () => {
    const { transform } = await prepared({
      stylesheets: {
        "/app/src/app.css": '@import "./base/tailwind.css";',
        "/app/src/base/tailwind.css": APP_CSS,
      },
    });

    expect(
      transform('@import "./app.css";', "/app/src/route.css"),
    ).not.toBeNull();
  });

  it("gives up on a stylesheet that imports itself", async () => {
    const { transform } = await prepared({
      stylesheets: { "/app/src/loop.css": '@import "./loop.css";' },
    });

    expect(transform('@import "./loop.css";', "/app/src/loop.css")).toBeNull();
  });

  it("leaves a package stylesheet's imports to that package", async () => {
    const { transform } = await prepared({
      stylesheets: { "/app/src/styles.css": APP_CSS },
    });

    expect(
      transform('@import "fumadocs-ui/css/preset.css";', "/app/src/docs.css"),
    ).toBeNull();
  });

  it("leaves modules that are not stylesheets alone", async () => {
    const { transform } = await prepared();

    expect(transform(APP_CSS, "/app/src/main.tsx")).toBeNull();
  });

  it("answers a stylesheet Vite asks for with a query", async () => {
    const { transform } = await prepared();

    expect(transform(APP_CSS, "/app/src/styles.css?direct")).not.toBeNull();
  });

  it("skips a package that is not installed", async () => {
    const { transform } = await prepared({
      readBuildOutput: (appRoot, packageName) =>
        packageName === "@acme/blog" ? null : installed(appRoot, packageName),
    });

    expect(
      sourcesIn(transform(APP_CSS, "/app/src/styles.css")?.code ?? ""),
    ).toEqual(["/app/node_modules/@vitnode/core/dist/src/**/*.js"]);
  });

  it("writes POSIX separators for a Windows install path", async () => {
    const { transform } = await prepared({
      readBuildOutput: () =>
        String.raw`C:\app\node_modules\@vitnode\core\dist\src`,
      readPluginIds: vi.fn(async () => Promise.resolve([])),
    });

    expect(
      sourcesIn(transform(APP_CSS, "/app/src/styles.css")?.code ?? ""),
    ).toEqual(["C:/app/node_modules/@vitnode/core/dist/src/**/*.js"]);
  });

  it("runs before the Tailwind plugin reads the stylesheet", async () => {
    const { plugin } = await prepared();

    expect(plugin.enforce).toBe("pre");
  });

  it("reads the configured plugins from the app root it was given", async () => {
    const readPluginIds = vi.fn(async () => Promise.resolve([]));

    vitNodeTailwindSources({ appRoot: "/app", readPluginIds });
    await prepared({ readPluginIds });

    expect(readPluginIds).toHaveBeenCalledWith("/app");
  });
});
