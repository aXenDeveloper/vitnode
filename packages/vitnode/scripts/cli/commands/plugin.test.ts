// @vitest-environment node
import { transformFile } from "@swc/core";
import { createJiti } from "jiti";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UserError, ValidationError } from "../errors";
import { validatePlugin } from "../plugins/validate";
import { createScriptedPrompter, createTestContext } from "../testing";
import { runPluginCreateCommand } from "./plugin-create";
import { runPluginListCommand } from "./plugin-list";
import { runPluginValidateCommand } from "./plugin-validate";

const packageRoot = join(import.meta.dirname, "..", "..", "..");
const coreSrc = join(packageRoot, "src");

let root: string;

const write = (path: string, content: unknown) => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    typeof content === "string" ? content : JSON.stringify(content, null, 2),
  );
};

/** What `pnpm install` does for a workspace dependency: a link in the app. */
const link = (name: string) => {
  const target = join(root, "apps", "web", "node_modules", "@acme", name);
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target))
    symlinkSync(join(root, "plugins", name), target, "junction");
};

/** A workspace with an app and the given plugin packages. */
const workspace = (plugins: string[] = []) => {
  write("pnpm-workspace.yaml", "packages:\n  - apps/*\n  - plugins/*\n");
  write("package.json", { name: "acme", private: true });
  write("apps/web/package.json", { name: "web" });
  write(
    "apps/web/src/vitnode.config.ts",
    "export const vitNodeConfig = { plugins: [] };\n",
  );
  for (const name of plugins) {
    write(`plugins/${name}/package.json`, {
      dependencies: { "@vitnode/core": "workspace:*" },
      exports: { "./*": "./dist/src/*.js" },
      name: `@acme/${name}`,
      type: "module",
      version: "1.4.0",
    });
    write(`plugins/${name}/src/config.tsx`, "");
    link(name);
  }
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-plugin-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const create = async (
  options: Parameters<typeof runPluginCreateCommand>[1],
  runtime: Parameters<typeof createTestContext>[0] = {},
) => {
  const { context, runtime: fake } = createTestContext({
    cwd: root,
    ...runtime,
  });

  return {
    code: await runPluginCreateCommand(context, options),
    output: fake.output(),
  };
};

describe("vitnode plugin create", () => {
  it("creates the canonical plugin in the workspace's plugins folder", async () => {
    workspace(["forum"]);

    const { code, output } = await create({ name: "blog" });

    expect(code).toBe(0);
    for (const step of [
      "Package created",
      "Plugin definition",
      "Required structure",
      "Translations",
      "Tests",
      "Documentation",
    ]) {
      expect(output).toContain(`✓ ${step}`);
    }
    expect(output).toContain("plugins/blog");

    const manifest = JSON.parse(
      readFileSync(join(root, "plugins/blog/package.json"), "utf8"),
    ) as {
      description: string;
      name: string;
      scripts: Record<string, string>;
    };
    // Joins the scope the workspace's plugins already share.
    expect(manifest.name).toBe("@acme/blog");
    expect(manifest.description).toBe("A VitNode plugin.");
    expect(manifest.scripts["build:plugins"]).toBe("vitnode build");
    expect(
      readFileSync(join(root, "plugins/blog/src/routes.ts"), "utf8"),
    ).toContain('page("/blog"');
    expect(
      readFileSync(join(root, "plugins/blog/src/config.tsx"), "utf8"),
    ).toContain("export const blogPlugin");
    expect(
      readFileSync(join(root, "plugins/blog/src/config.api.ts"), "utf8"),
    ).toContain("export const blogApiPlugin");
  });

  it("generates exactly the canonical structure, with no feature options", async () => {
    workspace();
    await create({ name: "blog", packageName: "@acme/blog" });

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else
          files.push(
            relative(join(root, "plugins/blog"), path).replaceAll("\\", "/"),
          );
      }
    };
    walk(join(root, "plugins/blog"));

    expect(files.sort()).toMatchInlineSnapshot(`
      [
        ".npmignore",
        ".swcrc",
        "README.md",
        "eslint.config.mjs",
        "global.d.ts",
        "package.json",
        "src/api/modules/hello/hello.module.test.ts",
        "src/api/modules/hello/hello.module.ts",
        "src/api/modules/hello/hello.route.ts",
        "src/config.api.ts",
        "src/config.tsx",
        "src/const.ts",
        "src/locales/en.json",
        "src/locales/index.ts",
        "src/pages/home-page.tsx",
        "src/routes.ts",
        "tsconfig.build.json",
        "tsconfig.json",
        "vitest.config.ts",
      ]
    `);
  });

  it("uses the given package name and description", async () => {
    workspace();
    await create({
      description: "Blogging for VitNode",
      name: "blog",
      packageName: "@acme/blog",
    });

    expect(
      readFileSync(join(root, "plugins/blog/package.json"), "utf8"),
    ).toContain('"description": "Blogging for VitNode"');
    expect(
      readFileSync(join(root, "plugins/blog/src/const.ts"), "utf8"),
    ).toContain('pluginId: "@acme/blog"');
  });

  it("asks for the name - and only metadata it cannot derive - when interactive", async () => {
    workspace();
    const prompter = createScriptedPrompter({
      text: ["blog", "", "Blogging for VitNode"],
    });

    await create({}, { interactive: true, prompter });

    expect(prompter.asked).toEqual([
      "Plugin name",
      "Package name",
      "Description",
    ]);
    expect(
      readFileSync(join(root, "plugins/blog/package.json"), "utf8"),
    ).toContain('"name": "vitnode-plugin-blog"');
  });

  it("requires the name as an argument when nobody can be asked", async () => {
    workspace();

    await expect(create({})).rejects.toThrow(UserError);
    expect(existsSync(join(root, "plugins"))).toBe(false);
  });

  it.each([
    ["an invalid name", { name: "My Blog" }, "not a valid plugin name"],
    ["a reserved name", { name: "admin" }, "reserved"],
    [
      "an invalid package name",
      { name: "blog", packageName: "Blog" },
      "lowercase",
    ],
    [
      "core's package name",
      { name: "blog", packageName: "@vitnode/core" },
      "core package",
    ],
  ])("refuses %s before writing anything", async (_, options, message) => {
    workspace();

    await expect(create(options)).rejects.toThrow(message);
    expect(existsSync(join(root, "plugins", "blog"))).toBe(false);
  });

  it("never overwrites an existing plugin folder", async () => {
    workspace();
    write("plugins/blog/README.md", "mine");

    await expect(create({ name: "blog" })).rejects.toThrow(
      "already exists and is not empty",
    );
    expect(readFileSync(join(root, "plugins/blog/README.md"), "utf8")).toBe(
      "mine",
    );
  });

  it("refuses a package name - and so a plugin id - the workspace already has", async () => {
    workspace(["forum"]);

    await expect(
      create({ name: "community", packageName: "@acme/forum" }),
    ).rejects.toThrow(
      'A package named "@acme/forum" already exists at plugins/forum',
    );
  });

  it("refuses to run outside a workspace", async () => {
    write("package.json", { name: "solo" });

    await expect(create({ name: "blog" })).rejects.toThrow(
      "inside a workspace",
    );
  });
});

/**
 * The strongest check there is: generate a plugin, compile it with the
 * `.swcrc` it was generated with - the same compiler step `vitnode build`
 * runs - and hand the output to the same validator `vitnode plugin validate`
 * uses, which loads it through VitNode's real plugin, route and API loaders.
 */
describe("a generated plugin", () => {
  let loadRoot: string;

  beforeEach(() => {
    // Loaded from inside the package, so the compiled plugin resolves `hono`
    // and friends from core's own node_modules. Compiled elsewhere, because
    // swc leaves path aliases alone in files under node_modules.
    const cache = join(packageRoot, "node_modules", ".cache");
    mkdirSync(cache, { recursive: true });
    loadRoot = mkdtempSync(join(cache, "vitnode-generated-plugin-"));
  });

  afterEach(() => {
    rmSync(loadRoot, { force: true, recursive: true });
  });

  it("compiles and passes validation through the real plugin loaders", async () => {
    workspace();
    await create({ name: "blog", packageName: "@acme/blog" });
    const source = join(root, "plugins", "blog");
    const plugin = join(loadRoot, "blog");
    const swcrc = JSON.parse(
      readFileSync(join(source, ".swcrc"), "utf8"),
    ) as Record<string, unknown> & {
      jsc: Record<string, unknown>;
    };

    const compile = async (dir: string) => {
      for (const entry of readdirSync(join(source, dir))) {
        const file = join(source, dir, entry);
        const target = join(source, "dist", dir, entry);
        if (statSync(file).isDirectory()) {
          await compile(join(dir, entry));
          continue;
        }
        mkdirSync(dirname(target), { recursive: true });
        if (entry.endsWith(".json")) {
          cpSync(file, target);
          continue;
        }
        if (entry.includes(".test.")) continue;
        const { code } = await transformFile(file, {
          ...swcrc,
          $schema: undefined,
          exclude: undefined,
          filename: file,
          jsc: { ...swcrc.jsc, baseUrl: source },
          swcrc: false,
        } as Parameters<typeof transformFile>[1]);
        writeFileSync(target.replace(/\.tsx?$/, ".js"), code);
      }
    };
    await compile("src");
    cpSync(source, plugin, { recursive: true });

    const jiti = createJiti(import.meta.url, {
      alias: { "@/": `${coreSrc}/`, "@vitnode/core/": `${coreSrc}/` },
      interopDefault: false,
      moduleCache: false,
    });

    const result = await validatePlugin(plugin, {
      importModule: async file => jiti.import(file),
    });

    expect(result.checks.filter(check => check.status !== "ok")).toEqual([]);
    expect(result.checks.map(check => check.name)).toEqual([
      "Package",
      "Plugin definition",
      "API definition",
      "Routes",
      "Translations",
    ]);
    expect(result.valid).toBe(true);
  }, 60_000);
});

/** A plugin's build output, written by hand: plain ESM, no imports. */
const builtPlugin = (
  name: string,
  {
    apiPermissions = {},
    locale = { [`@acme/${name}`]: { home: { title: "Hi" } } },
    navPermission,
    pluginId = `@acme/${name}`,
  }: {
    apiPermissions?: Record<string, string[]>;
    locale?: unknown;
    navPermission?: { module: string; permission: string };
    pluginId?: string;
  } = {},
) => {
  const base = `plugins/${name}`;
  write(`${base}/package.json`, {
    dependencies: { "@vitnode/core": "workspace:*" },
    exports: {
      "./*": { default: "./dist/src/*.js", import: "./dist/src/*.js" },
      "./locales/*.json": "./src/locales/*.json",
    },
    name: `@acme/${name}`,
    type: "module",
    version: "1.0.0",
  });
  write(`${base}/src/config.tsx`, "");
  link(name);
  write(`${base}/src/locales/en.json`, locale);
  write(
    `${base}/dist/src/config.js`,
    `export const plugin = () => ({ pluginId: ${JSON.stringify(pluginId)}, localeFiles: { en: "@acme/${name}/locales/en.json" } });\n`,
  );
  write(
    `${base}/dist/src/config.api.js`,
    `export const apiPlugin = () => ({ pluginId: ${JSON.stringify(pluginId)}, permissionStaff: { admin: ${JSON.stringify(apiPermissions)} } });\n`,
  );
  if (navPermission) {
    write(
      `${base}/dist/src/admin/nav.js`,
      `export const adminNav = { pluginId: "@acme/${name}", admin: { nav: [{ id: "posts", href: "/admin/${name}", permission: ${JSON.stringify(navPermission)} }] } };\n`,
    );
  }
};

const validate = async (name?: string, cwd = join(root, "apps", "web")) => {
  const { context, runtime } = createTestContext({ cwd });

  try {
    const code = await runPluginValidateCommand(
      context,
      { name },
      {
        loadIds: async () => await Promise.resolve(["@acme/blog"]),
      },
    );

    return { code, error: null, output: runtime.output() };
  } catch (error) {
    return { code: null, error, output: runtime.output() };
  }
};

describe("vitnode plugin validate", () => {
  it("passes a valid plugin", async () => {
    workspace();
    builtPlugin("blog", {
      apiPermissions: { posts: ["can_manage"] },
      navPermission: { module: "posts", permission: "can_manage" },
    });

    const { code, output } = await validate("blog");

    expect(code).toBe(0);
    expect(output).toContain("✓ Plugin definition");
    expect(output).toContain("✓ AdminCP navigation");
    expect(output).toContain("✓ 1 plugin valid");
  });

  it("validates the plugin it is run inside", async () => {
    workspace();
    builtPlugin("blog");

    const { code, output } = await validate(
      undefined,
      join(root, "plugins", "blog"),
    );

    expect(code).toBe(0);
    expect(output).toContain("@acme/blog");
  });

  it("fails on a navigation item that requires an unregistered permission", async () => {
    workspace();
    builtPlugin("blog", {
      navPermission: { module: "posts", permission: "can_manage" },
    });

    const { error, output } = await validate("blog");

    expect(error).toBeInstanceOf(ValidationError);
    expect(output).toContain("✖ AdminCP navigation");
    expect(output).toContain("requires the permission posts.can_manage");
  });

  it("fails on a plugin id that is not its package name", async () => {
    workspace();
    builtPlugin("blog", { pluginId: "@acme/other" });

    const { error, output } = await validate("blog");

    expect(error).toBeInstanceOf(ValidationError);
    expect(output).toContain(
      'pluginId is "@acme/other" but the package is "@acme/blog"',
    );
  });

  it("fails on translations without the plugin's own namespace", async () => {
    workspace();
    builtPlugin("blog", { locale: { title: "Hi" } });

    const { error, output } = await validate("blog");

    expect(error).toBeInstanceOf(ValidationError);
    expect(output).toContain('has no top-level "@acme/blog" key');
  });

  it("fails - and says how to fix it - when the plugin has not been built", async () => {
    workspace(["blog"]);

    const { error, output } = await validate("blog");

    expect(error).toBeInstanceOf(ValidationError);
    expect(output).toContain("dist/src/config.js does not exist");
  });

  it("fails on a package.json that cannot be imported by an app", async () => {
    workspace();
    builtPlugin("blog");
    write("plugins/blog/package.json", {
      dependencies: { "@vitnode/core": "*" },
      name: "@acme/blog",
    });

    const { output } = await validate("blog");

    expect(output).toContain('must set "type": "module"');
    expect(output).toContain('"exports" must map');
  });

  it("refuses a plugin name it cannot find", async () => {
    workspace();

    const { error } = await validate("nope");

    expect(error).toBeInstanceOf(UserError);
  });
});

describe("vitnode plugin list", () => {
  const list = async (ids: Error | string[]) => {
    const { context, runtime } = createTestContext({
      cwd: join(root, "apps", "web"),
    });
    const code = await runPluginListCommand(
      context,
      {},
      {
        loadIds: async () => {
          await Promise.resolve();
          if (ids instanceof Error) throw ids;

          return ids;
        },
      },
    );

    return { code, output: runtime.output() };
  };

  it("lists configured plugins with their version and source", async () => {
    workspace(["blog", "forum"]);
    write("apps/web/node_modules/@acme/search/package.json", {
      name: "@acme/search",
      version: "1.1.2",
    });

    const { code, output } = await list(["@acme/blog", "@acme/search"]);

    expect(code).toBe(0);
    expect(output).toMatch(/@acme\/blog\s+1\.4\.0\s+workspace/);
    expect(output).toMatch(/@acme\/search\s+1\.1\.2\s+package/);
    expect(output).toMatch(
      /@acme\/forum \(not configured\)\s+1\.4\.0\s+workspace/,
    );
    expect(output).toContain("2 plugins configured in this app");
  });

  it("says so when there are no plugins", async () => {
    workspace();

    const { code, output } = await list([]);

    expect(code).toBe(0);
    expect(output).toContain("No plugins configured yet.");
  });

  it("reports a plugin that is configured but not installed", async () => {
    workspace();

    expect((await list(["@acme/missing"])).output).toMatch(
      /@acme\/missing\s+not installed/,
    );
  });

  it("explains a config that cannot be loaded", async () => {
    workspace();

    await expect(list(new Error("pluginId must be a string"))).rejects.toThrow(
      "Could not load the plugins configured in",
    );
  });
});
