import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  PluginConfigRegistration,
  RegisterPluginStatus,
} from "./add-plugin-to-config.js";

import {
  addPluginToConfig,
  needsManualRegistration,
  registerPluginInSource,
} from "./add-plugin-to-config.js";

const APP_CONFIG = `import { buildConfig } from "@vitnode/core/vitnode.config";

export const vitNodeConfig = buildConfig({
  debug: false,
  metadata: {
    shortTitle: "VitNode",
    title: "VitNode",
  },
  plugins: [],
  theme: {
    defaultTheme: "system",
  },
});
`;

const API_CONFIG = `import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { coreRelations } from "@vitnode/core/database/relations";
import { drizzle } from "drizzle-orm/postgres-js";

export const vitNodeApiConfig = buildApiConfig({
  plugins: [],
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    relations: coreRelations,
  }),
});
`;

const app = (source: string) =>
  registerPluginInSource(source, {
    builder: "buildConfig",
    factory: "siteNotesPlugin",
    module: "@acme/site-notes/config",
  });

describe("registerPluginInSource", () => {
  it("imports the factory and calls it in the empty plugins array", () => {
    const { source, status } = app(APP_CONFIG);

    expect(status).toBe("registered");
    expect(source).toContain(
      'import { siteNotesPlugin } from "@acme/site-notes/config";',
    );
    expect(source).toContain("plugins: [siteNotesPlugin()],");
  });

  it("leaves the rest of the config untouched", () => {
    const { source } = app(APP_CONFIG);

    expect(source).toContain('defaultTheme: "system",');
    expect(source).toContain("debug: false,");
    expect(source.split("buildConfig(")).toHaveLength(2);
  });

  it("appends to a plugins array that already has entries", () => {
    const { source } = app(
      APP_CONFIG.replace("plugins: []", "plugins: [blogPlugin()]"),
    );

    expect(source).toContain("plugins: [blogPlugin(), siteNotesPlugin()],");
  });

  it("keeps a multi-line plugins array multi-line, at its own indent", () => {
    const { source } = app(
      APP_CONFIG.replace(
        "plugins: [],",
        "plugins: [\n    blogPlugin(),\n    examplePlugin(),\n  ],",
      ),
    );

    expect(source).toContain(
      "plugins: [\n    blogPlugin(),\n    examplePlugin(),\n    siteNotesPlugin(),\n  ],",
    );
  });

  it("adds the comma a single-entry multi-line array was missing", () => {
    const { source } = app(
      APP_CONFIG.replace("plugins: [],", "plugins: [\n    blogPlugin()\n  ],"),
    );

    expect(source).toContain(
      "plugins: [\n    blogPlugin(),\n    siteNotesPlugin(),\n  ],",
    );
  });

  it("does nothing the second time it runs", () => {
    const once = app(APP_CONFIG);
    const twice = app(once.source);

    expect(twice.status).toBe("already-registered");
    expect(twice.source).toBe(once.source);
  });

  it("adds only the half that is missing", () => {
    const importOnly = `import { siteNotesPlugin } from "@acme/site-notes/config";\n${APP_CONFIG}`;
    const { source, status } = app(importOnly);

    expect(status).toBe("registered");
    expect(source.match(/import \{ siteNotesPlugin \}/g)).toHaveLength(1);
    expect(source).toContain("plugins: [siteNotesPlugin()],");
  });

  it("sorts the import in, which is what the lint rule expects", () => {
    const { source } = app(APP_CONFIG);
    const specifiers = [...source.matchAll(/from "([^"]+)"/g)].map(
      match => match[1],
    );

    expect(specifiers).toEqual([
      "@acme/site-notes/config",
      "@vitnode/core/vitnode.config",
    ]);
  });

  it("falls back to the end of the block when nothing sorts after it", () => {
    const { source } = registerPluginInSource(APP_CONFIG, {
      builder: "buildConfig",
      factory: "zzPlugin",
      module: "zz-plugin/config",
    });
    const specifiers = [...source.matchAll(/from "([^"]+)"/g)].map(
      match => match[1],
    );

    expect(specifiers).toEqual([
      "@vitnode/core/vitnode.config",
      "zz-plugin/config",
    ]);
  });

  it("never sorts a value import above a type import", () => {
    const withType = `import type { LocaleMessagesMap } from "@vitnode/core/lib/i18n/types";\n\n${APP_CONFIG}`;
    const { source } = app(withType);

    expect(source.indexOf("import type")).toBeLessThan(
      source.indexOf("import { siteNotesPlugin }"),
    );
  });

  it("matches the file's quote and semicolon style", () => {
    const prettierless = APP_CONFIG.replace(
      'import { buildConfig } from "@vitnode/core/vitnode.config";',
      "import { buildConfig } from '@vitnode/core/vitnode.config'",
    );
    const { source } = app(prettierless);

    expect(source).toContain(
      "import { siteNotesPlugin } from '@acme/site-notes/config'",
    );
    expect(source).not.toContain("'@acme/site-notes/config';");
  });

  it("registers the API factory in the API config", () => {
    const { source, status } = registerPluginInSource(API_CONFIG, {
      builder: "buildApiConfig",
      factory: "siteNotesApiPlugin",
      module: "@acme/site-notes/config.api",
    });

    expect(status).toBe("registered");
    expect(source).toContain(
      'import { siteNotesApiPlugin } from "@acme/site-notes/config.api";',
    );
    expect(source).toContain("plugins: [siteNotesApiPlugin()],");
  });

  it("ignores a plugins array that is not the config's", () => {
    const vite = `import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
`;

    expect(app(vite).status).toBe("no-config-call");
    expect(app(vite).source).toBe(vite);
  });

  it("reports a config it cannot find a plugins array in", () => {
    const noPlugins = APP_CONFIG.replace("  plugins: [],\n", "");
    const { source, status } = app(noPlugins);

    expect(status).toBe("no-plugins-array");
    expect(source).toBe(noPlugins);
  });

  it("skips a plugins array inside a nested call", () => {
    const nested = APP_CONFIG.replace(
      "plugins: [],",
      'editor: { emojis: [{ label: "]" }] },\n  plugins: [],',
    );

    expect(app(nested).source).toContain("plugins: [siteNotesPlugin()],");
  });
});

describe("finding the array the config actually uses", () => {
  it("skips a commented-out plugins key", () => {
    const { source } = app(
      APP_CONFIG.replace("  plugins: [],", "  // plugins: [],\n  plugins: [],"),
    );

    expect(source).toContain("// plugins: [],");
    expect(source).toContain("plugins: [siteNotesPlugin()],");
  });

  it("skips a plugins key inside a block comment", () => {
    const { source } = app(
      APP_CONFIG.replace(
        "  plugins: [],",
        "  /* plugins: [oldPlugin()] */\n  plugins: [],",
      ),
    );

    expect(source).toContain("/* plugins: [oldPlugin()] */");
    expect(source).toContain("plugins: [siteNotesPlugin()],");
  });

  it("skips a nested property that happens to be called plugins", () => {
    const { source } = app(
      APP_CONFIG.replace(
        "  plugins: [],",
        "  editor: { plugins: [] },\n  plugins: [],",
      ),
    );

    expect(source).toContain("editor: { plugins: [] },");
    expect(source).toContain("plugins: [siteNotesPlugin()],");
  });

  it("skips a plugins key inside a string", () => {
    const { source } = app(
      APP_CONFIG.replace(
        "  plugins: [],",
        '  note: "plugins: [x()]",\n  plugins: [],',
      ),
    );

    expect(source).toContain('note: "plugins: [x()]",');
    expect(source).toContain("plugins: [siteNotesPlugin()],");
  });

  it("still finds a quoted key", () => {
    const { source } = app(APP_CONFIG.replace("plugins:", '"plugins":'));

    expect(source).toContain('"plugins": [siteNotesPlugin()],');
  });

  it("reports a builder call it only sees in a comment", () => {
    const commented = `export const vitNodeConfig = {
  // was: buildConfig({ plugins: [] })
  plugins: [],
};
`;

    expect(app(commented).status).toBe("no-config-call");
  });

  it("reports an aliased builder rather than editing the wrong thing", () => {
    const aliased = APP_CONFIG.replace(
      "import { buildConfig }",
      "import { buildConfig as build }",
    ).replace("buildConfig({", "build({");

    expect(app(aliased).status).toBe("no-config-call");
    expect(app(aliased).source).toBe(aliased);
  });

  it("does not mistake a longer identifier for the builder", () => {
    const other = APP_CONFIG.replace("buildConfig({", "myBuildConfig({");

    expect(app(other).status).toBe("no-config-call");
  });
});

describe("entries that carry a comment", () => {
  it("puts the comma before a trailing line comment, not inside it", () => {
    const { source } = app(
      APP_CONFIG.replace(
        "plugins: [],",
        "plugins: [\n    blogPlugin() // keep this\n  ],",
      ),
    );

    expect(source).toContain(
      "plugins: [\n    blogPlugin(), // keep this\n    siteNotesPlugin(),\n  ],",
    );
    expect(source).not.toContain("// keep this,");
  });

  it("puts the comma before a trailing block comment", () => {
    const { source } = app(
      APP_CONFIG.replace(
        "plugins: [],",
        "plugins: [\n    blogPlugin() /* keep */\n  ],",
      ),
    );

    expect(source).toContain(
      "plugins: [\n    blogPlugin(), /* keep */\n    siteNotesPlugin(),\n  ],",
    );
  });

  it("adds no second comma when the entry already has one", () => {
    const { source } = app(
      APP_CONFIG.replace(
        "plugins: [],",
        "plugins: [\n    blogPlugin(), // keep this\n  ],",
      ),
    );

    expect(source).toContain("blogPlugin(), // keep this");
    expect(source).not.toContain("blogPlugin(),, ");
  });

  it("is not fooled by a comment marker inside a string argument", () => {
    const { source } = app(
      APP_CONFIG.replace(
        "plugins: [],",
        'plugins: [\n    blogPlugin("//")\n  ],',
      ),
    );

    expect(source).toContain(
      'plugins: [\n    blogPlugin("//"),\n    siteNotesPlugin(),\n  ],',
    );
  });
});

describe("needsManualRegistration", () => {
  const at = (status: RegisterPluginStatus): PluginConfigRegistration => ({
    file: `/${status}.ts`,
    status,
  });

  it("names every config the generator could not edit", () => {
    expect(
      needsManualRegistration([
        at("registered"),
        at("already-registered"),
        at("no-plugins-array"),
        at("no-config-call"),
      ]).map(({ file }) => file),
    ).toEqual(["/no-plugins-array.ts", "/no-config-call.ts"]);
  });

  it("reports an unrecognised config even when another one succeeded", () => {
    expect(
      needsManualRegistration([at("registered"), at("no-config-call")]),
    ).toHaveLength(1);
  });

  it("stays quiet when every config was handled", () => {
    expect(
      needsManualRegistration([at("registered"), at("already-registered")]),
    ).toEqual([]);
  });
});

describe("addPluginToConfig", () => {
  let root = "";

  const write = async (file: string, contents: string) => {
    await mkdir(join(root, file, ".."), { recursive: true });
    await writeFile(join(root, file), contents, "utf-8");
  };

  const read = async (file: string) =>
    await readFile(join(root, file), "utf-8");

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "create-vitnode-config-"));
    await write("turbo.json", "{}\n");
    await write(
      "apps/web/package.json",
      JSON.stringify({ dependencies: { "@vitnode/core": "*" }, name: "web" }),
    );
    await write("apps/web/src/vitnode.config.ts", APP_CONFIG);
    await write("apps/web/src/vitnode.api.config.ts", API_CONFIG);
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  const run = async () =>
    await addPluginToConfig({
      pluginName: "@acme/site-notes",
      pluginPath: join(root, "plugins/site-notes"),
      rootPath: root,
    });

  it("registers the plugin in both of the app's configs", async () => {
    const registrations = await run();

    expect(registrations.map(entry => entry.status)).toEqual([
      "registered",
      "registered",
    ]);
    expect(await read("apps/web/src/vitnode.config.ts")).toContain(
      "plugins: [siteNotesPlugin()],",
    );
    expect(await read("apps/web/src/vitnode.api.config.ts")).toContain(
      "plugins: [siteNotesApiPlugin()],",
    );
  });

  it("imports each half from the subpath that serves it", async () => {
    await run();

    expect(await read("apps/web/src/vitnode.config.ts")).toContain(
      '"@acme/site-notes/config"',
    );
    expect(await read("apps/web/src/vitnode.api.config.ts")).toContain(
      '"@acme/site-notes/config.api"',
    );
  });

  it("leaves a package that does not depend on VitNode alone", async () => {
    await write("apps/marketing/package.json", JSON.stringify({ name: "mkt" }));
    await write("apps/marketing/src/vitnode.config.ts", APP_CONFIG);

    await run();

    expect(await read("apps/marketing/src/vitnode.config.ts")).toBe(APP_CONFIG);
  });

  it("does not walk into node_modules or dist", async () => {
    await write(
      "node_modules/@acme/other/package.json",
      JSON.stringify({ dependencies: { "@vitnode/core": "*" }, name: "other" }),
    );
    await write("node_modules/@acme/other/vitnode.config.ts", APP_CONFIG);
    await write("apps/web/dist/vitnode.config.ts", APP_CONFIG);

    const registrations = await run();

    expect(registrations).toHaveLength(2);
    expect(await read("node_modules/@acme/other/vitnode.config.ts")).toBe(
      APP_CONFIG,
    );
    expect(await read("apps/web/dist/vitnode.config.ts")).toBe(APP_CONFIG);
  });

  it("skips the plugin's own directory", async () => {
    await write(
      "plugins/site-notes/package.json",
      JSON.stringify({
        dependencies: { "@vitnode/core": "*" },
        name: "@acme/site-notes",
      }),
    );
    await write("plugins/site-notes/src/vitnode.config.ts", APP_CONFIG);

    await run();

    expect(await read("plugins/site-notes/src/vitnode.config.ts")).toBe(
      APP_CONFIG,
    );
  });

  it("is safe to run twice", async () => {
    await run();
    const after = await read("apps/web/src/vitnode.config.ts");
    const registrations = await run();

    expect(registrations.map(entry => entry.status)).toEqual([
      "already-registered",
      "already-registered",
    ]);
    expect(await read("apps/web/src/vitnode.config.ts")).toBe(after);
  });

  it("reports every config it found, so the CLI can say what it did", async () => {
    await write(
      "apps/api/package.json",
      JSON.stringify({ dependencies: { "@vitnode/core": "*" }, name: "api" }),
    );
    await write("apps/api/src/vitnode.api.config.ts", API_CONFIG);

    const registrations = await run();

    expect(registrations.map(entry => entry.file.replace(root, ""))).toEqual([
      join("/apps/api/src/vitnode.api.config.ts"),
      join("/apps/web/src/vitnode.api.config.ts"),
      join("/apps/web/src/vitnode.config.ts"),
    ]);
  });

  it("returns nothing when the workspace has no config to edit", async () => {
    await rm(join(root, "apps"), { force: true, recursive: true });

    await expect(run()).resolves.toEqual([]);
  });
});
