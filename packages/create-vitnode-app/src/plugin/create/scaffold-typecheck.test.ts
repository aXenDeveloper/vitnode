import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pluginRouteScaffold } from "./route-templates.js";

const PLUGIN_NAME = "@acme/notes";

const repoRoot = resolve(import.meta.dirname, "../../../../..");
const corePackage = join(repoRoot, "packages", "vitnode");
const configPackage = join(repoRoot, "packages", "config");
const templateRoot = join(
  repoRoot,
  "packages",
  "create-vitnode-app",
  "copy-of-vitnode-plugin",
  "root",
);

const coreIsBuilt = existsSync(
  join(corePackage, "dist", "src", "tanstack", "fetcher", "index.d.ts"),
);

const PROBE = `import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { CONFIG_PLUGIN } from "@/const";

export const hello = async () => {
  const response = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "hello",
    path: "/",
  });

  const status: 200 = response.status;
  const message: string = (await response.json()).message;

  return { message, status };
};

export const literal = async () =>
  await fetcher({
    plugin: "${PLUGIN_NAME}",
    method: "get",
    module: "hello",
    path: "/",
  });

export const wrongModule = async () =>
  await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    // @ts-expect-error -- the scaffold mounts only \`hello\`
    module: "notes",
    path: "/",
  });

export const wrongMethod = async () =>
  await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    // @ts-expect-error -- \`/\` is a \`get\`
    method: "post",
    module: "hello",
    path: "/",
  });

export const wrongPlugin = async () =>
  await fetcher({
    // @ts-expect-error -- only registered plugins are callable
    plugin: "@acme/other",
    method: "get",
    module: "hello",
    path: "/",
  });
`;

const linkEntries = async (from: string, into: string): Promise<void> => {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name === ".bin") continue;

    const target = join(from, entry.name);
    const link = join(into, entry.name);

    if (entry.name.startsWith("@")) {
      await mkdir(link, { recursive: true });
      await linkEntries(target, link);
      continue;
    }

    if (!existsSync(link)) await symlink(target, link);
  }
};

const writeScaffold = async (pluginPath: string): Promise<void> => {
  const files = {
    ...pluginRouteScaffold(PLUGIN_NAME),
    "src/probe.ts": PROBE,
    "tsconfig.check.json": JSON.stringify({
      compilerOptions: {
        declaration: false,
        declarationMap: false,
        emitDeclarationOnly: false,
        incremental: false,
        noEmit: true,
      },
      extends: "./tsconfig.json",
    }),
    "tsconfig.json": await readFile(
      join(templateRoot, "tsconfig.json"),
      "utf8",
    ),
  };

  for (const [file, contents] of Object.entries(files)) {
    await mkdir(dirname(join(pluginPath, file)), { recursive: true });
    await writeFile(join(pluginPath, file), contents, "utf8");
  }

  const modules = join(pluginPath, "node_modules");
  await mkdir(join(modules, "@vitnode"), { recursive: true });
  await symlink(corePackage, join(modules, "@vitnode", "core"));
  await symlink(configPackage, join(modules, "@vitnode", "config"));
  await linkEntries(join(corePackage, "node_modules"), modules);
};

const typecheck = (pluginPath: string) =>
  spawnSync(
    process.execPath,
    [
      join(pluginPath, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      join(pluginPath, "tsconfig.check.json"),
      "--pretty",
      "false",
    ],
    { cwd: pluginPath, encoding: "utf8" },
  );

describe.skipIf(!coreIsBuilt)(
  "a generated plugin type-checks against the fetcher it ships with",
  () => {
    let pluginPath = "";
    let result: ReturnType<typeof typecheck>;

    beforeAll(async () => {
      pluginPath = await mkdtemp(join(tmpdir(), "vitnode-plugin-scaffold-"));
      await writeScaffold(pluginPath);
      result = typecheck(pluginPath);
    }, 240_000);

    afterAll(async () => {
      if (pluginPath) await rm(pluginPath, { force: true, recursive: true });
    });

    it("compiles the scaffold and a typed call to its own endpoint", () => {
      expect(result.stdout + result.stderr).toBe("");
      expect(result.status).toBe(0);
    });

    it("rejects a module, method or plugin the scaffold does not register", () => {
      // The `@ts-expect-error` lines in the probe are consumed only when the
      // call really is an error; an unused one fails the compile above.
      expect(PROBE.match(/@ts-expect-error/g)).toHaveLength(3);
    });
  },
);
