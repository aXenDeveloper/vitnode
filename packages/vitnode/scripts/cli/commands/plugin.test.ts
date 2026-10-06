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
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UserError, ValidationError } from "../errors";
import { validatePlugin } from "../plugins/validate";
import { createTestContext } from "../testing";
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

/**
 * The contract between `create-vitnode-app --plugin` and this CLI, checked
 * end to end: scaffold a plugin exactly as `create-vitnode-app` writes it,
 * compile it with the `.swcrc` it ships - the same compiler step
 * `vitnode build` runs - and hand the output to the validator
 * `vitnode plugin validate` uses, which loads it through VitNode's real
 * plugin, route and API loaders.
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
    const creator = join(packageRoot, "..", "create-vitnode-app");
    const { pluginPackageExports, pluginRouteScaffold } = (await import(
      pathToFileURL(
        join(creator, "src", "plugin", "create", "route-templates.ts"),
      ).href
    )) as {
      pluginPackageExports: () => Record<string, unknown>;
      pluginRouteScaffold: (name: string) => Record<string, string>;
    };
    const source = join(root, "plugins", "blog");
    cpSync(join(creator, "copy-of-vitnode-plugin", "root"), source, {
      recursive: true,
    });
    for (const [file, content] of Object.entries(
      pluginRouteScaffold("@acme/blog"),
    )) {
      write(join("plugins", "blog", file), content);
    }
    write("plugins/blog/package.json", {
      exports: pluginPackageExports(),
      name: "@acme/blog",
      type: "module",
      version: "0.1.0",
    });
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
