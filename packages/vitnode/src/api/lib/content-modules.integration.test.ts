// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ContentUrlDefinition } from "@/content/public-urls";

import { createContentModel } from "@/content/server/model";
import { buildContentPublicModule } from "@/content/server/public-module";
import { generateContentModulesSource } from "@/framework/content-modules";
import { compilePluginRoutes } from "@/framework/plugin-routes";
import {
  loadPluginContentUrls,
  resolvePluginContentModules,
  resolverFor,
} from "@/framework/vite/plugin-routes";
import { definePluginRoutes, lazy, page } from "@/routing/tree";
import { testDeliveredPostContentType } from "@/tests/content-fixtures";

import {
  assertPluginContentModules,
  generatedContentModules,
  packageContentModules,
} from "./content-modules";
import { buildApiPlugin } from "./plugin";

const PLUGIN_ID = "@acme/articles";
const PAGE_PATH = testDeliveredPostContentType.delivery.path;

const urlShape = (definition: ContentUrlDefinition) => ({
  delivery: {
    enabled: definition.delivery.enabled,
    path: definition.delivery.path,
  },
  id: definition.id,
  search: {
    enabled: definition.search.enabled,
    pathTemplate: definition.search.pathTemplate,
  },
});

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

const installApp = ({
  content,
  exportsContent,
}: {
  content?: readonly ContentUrlDefinition[];
  exportsContent: boolean;
}): string => {
  const appRoot = mkdtempSync(join(tmpdir(), "vitnode-content-modules-"));
  roots.push(appRoot);
  writeFileSync(
    join(appRoot, "package.json"),
    JSON.stringify({ name: "fixture-app", type: "module" }),
  );

  const packageRoot = join(appRoot, "node_modules", "@acme", "articles");
  mkdirSync(join(packageRoot, "lib", "public"), { recursive: true });
  writeFileSync(
    join(packageRoot, "package.json"),
    JSON.stringify({
      exports: {
        "./config": "./lib/config.js",
        ...(exportsContent ? { "./content": "./lib/public/content.js" } : {}),
      },
      name: PLUGIN_ID,
      type: "module",
    }),
  );
  writeFileSync(join(packageRoot, "lib", "config.js"), "export {};\n");

  if (content) {
    writeFileSync(
      join(packageRoot, "lib", "public", "content.js"),
      `export const contentTypes = ${JSON.stringify(content.map(urlShape))};\n`,
    );
  }

  return appRoot;
};

const webBuild = async (
  appRoot: string,
  { withPage }: { withPage: boolean },
) => {
  const modules = resolvePluginContentModules(
    [PLUGIN_ID],
    resolverFor(appRoot),
  );
  const contentUrls = await loadPluginContentUrls(modules);
  const generated = Object.fromEntries(
    await Promise.all(
      modules.map(
        async ({ file, pluginId }) =>
          [pluginId, (await import(file)) as unknown] as const,
      ),
    ),
  );

  compilePluginRoutes({
    contentUrls,
    sources: [
      {
        pluginId: PLUGIN_ID,
        routes: definePluginRoutes(
          withPage
            ? [
                page(PAGE_PATH, {
                  component: lazy(async () => await import("./plugin")),
                }),
              ]
            : [],
        ),
      },
    ],
  });

  return {
    generated,
    source: generateContentModulesSource(modules),
  };
};

const publishingPlugin = () =>
  buildApiPlugin({
    pluginId: PLUGIN_ID,
    modules: [
      buildContentPublicModule({
        pluginId: PLUGIN_ID,
        contentTypes: [createContentModel(testDeliveredPostContentType)],
      }),
    ],
  });

const bootChecks = (appRoot: string, generated: Record<string, unknown>) => ({
  separateApi: () =>
    assertPluginContentModules({
      loader: packageContentModules(appRoot),
      plugins: [publishingPlugin()],
    }),
  singleApp: () =>
    assertPluginContentModules({
      loader: generatedContentModules(generated),
      plugins: [publishingPlugin()],
    }),
});

describe("a plugin's public content URLs, from web build to API boot", () => {
  it("validates and boots a plugin whose content module covers what it publishes", async () => {
    const appRoot = installApp({
      content: [testDeliveredPostContentType],
      exportsContent: true,
    });

    const { generated, source } = await webBuild(appRoot, { withPage: true });
    const boot = bootChecks(appRoot, generated);

    expect(source).toContain(`from '${PLUGIN_ID}/content'`);
    expect(boot.singleApp).not.toThrow();
    expect(boot.separateApi).not.toThrow();
  });

  it("fails the web build when that module's URL has no page", async () => {
    const appRoot = installApp({
      content: [testDeliveredPostContentType],
      exportsContent: true,
    });

    await expect(webBuild(appRoot, { withPage: false })).rejects.toMatchObject({
      code: "content-url-without-page",
      contentTypeId: testDeliveredPostContentType.id,
      pattern: PAGE_PATH,
      pluginId: PLUGIN_ID,
    });
  });

  it("refuses to boot a plugin that publishes URLs the web build could not discover", async () => {
    const appRoot = installApp({
      content: [testDeliveredPostContentType],
      exportsContent: false,
    });

    const { generated, source } = await webBuild(appRoot, { withPage: false });
    const boot = bootChecks(appRoot, generated);

    expect(source).not.toContain(PLUGIN_ID);
    for (const check of [boot.singleApp, boot.separateApi]) {
      expect(check).toThrow(
        expect.objectContaining({
          code: "content-module-missing",
          contentTypeId: testDeliveredPostContentType.id,
          pluginId: PLUGIN_ID,
        }),
      );
    }
    expect(boot.separateApi).toThrow(`delivery.path "${PAGE_PATH}"`);
  });

  it("refuses to boot when the exported module leaves a published type out", async () => {
    const appRoot = installApp({ content: [], exportsContent: true });

    const { generated } = await webBuild(appRoot, { withPage: false });
    const boot = bootChecks(appRoot, generated);

    for (const check of [boot.singleApp, boot.separateApi]) {
      expect(check).toThrow(
        expect.objectContaining({
          code: "incomplete-content-types",
          contentTypeId: testDeliveredPostContentType.id,
        }),
      );
    }
  });

  it("refuses to boot when the exported module declares a different URL", async () => {
    const drifted = {
      ...testDeliveredPostContentType,
      delivery: {
        ...testDeliveredPostContentType.delivery,
        path: "/old/:slug",
      },
    };
    const appRoot = installApp({ content: [drifted], exportsContent: true });

    const { generated } = await webBuild(appRoot, { withPage: false }).catch(
      () => ({ generated: {} }),
    );
    const boot = bootChecks(appRoot, generated);

    expect(boot.separateApi).toThrow(
      expect.objectContaining({ code: "incomplete-content-types" }),
    );
    expect(boot.separateApi).toThrow(
      'exports it with delivery.path "/old/:slug"',
    );
  });

  it("asks nothing of a plugin that publishes no content URLs", () => {
    const appRoot = installApp({ exportsContent: false });

    expect(() =>
      assertPluginContentModules({
        loader: packageContentModules(appRoot),
        plugins: [buildApiPlugin({ pluginId: PLUGIN_ID })],
      }),
    ).not.toThrow();
  });
});
