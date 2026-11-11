import { createJiti } from "jiti";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { writePluginApiRegistry } from "../../write-plugin-api-registry";
import { writePluginManifest } from "../../write-plugin-manifest";
import { runCli } from "../index";
import { createFakeRuntime } from "../testing";

const packageRoot = join(import.meta.dirname, "..", "..", "..");
const creator = join(packageRoot, "..", "create-vitnode-app");

let root: string;

const write = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

/**
 * The plugin's node_modules, as a workspace install leaves it: core's own
 * dependencies, plus `@vitnode/core` itself - whose types come from its build
 * output, which CI downloads before the tests and `vitnode build` writes
 * locally.
 */
const linkDependencies = () => {
  const modules = join(root, "node_modules");
  mkdirSync(join(modules, "@vitnode"), { recursive: true });
  for (const entry of readdirSync(join(packageRoot, "node_modules"))) {
    if (entry === "@vitnode" || entry === ".bin") continue;
    symlinkSync(
      join(packageRoot, "node_modules", entry),
      join(modules, entry),
      "junction",
    );
  }
  symlinkSync(packageRoot, join(modules, "@vitnode", "core"), "junction");
  symlinkSync(
    join(packageRoot, "..", "config"),
    join(modules, "@vitnode", "config"),
    "junction",
  );
};

const generate = async (...argv: string[]) => {
  const runtime = createFakeRuntime({ cwd: root });
  const code = await runCli(["g", ...argv, "--plain"], runtime);
  if (code !== 0) {
    throw new Error(`vitnode g ${argv.join(" ")} failed:\n${runtime.errors()}`);
  }
};

/**
 * Calls the generated routes through the plugin's real API, the way an app
 * would type them: arguments the routes declare are required and checked.
 */
const FETCHER_CALLS = `import { fetcher } from "@vitnode/core/tanstack/fetcher";

export const showNote = async () => {
  const response = await fetcher({
    plugin: "@acme/notes",
    method: "get",
    module: "notes",
    path: "/{noteId}",
    args: { params: { noteId: "1" } },
  });
  const body = await response.json();
  const noteId: string = body.noteId;

  return noteId;
};

export const createTask = async () =>
  fetcher({
    plugin: "@acme/notes",
    method: "post",
    module: "tasks",
    path: "/",
    args: { body: { rank: 1, title: "Write tests" } },
  });

export const createTaskWithWrongBody = async () =>
  fetcher({
    plugin: "@acme/notes",
    method: "post",
    module: "tasks",
    path: "/",
    // @ts-expect-error title is a string
    args: { body: { rank: 1, title: 1 } },
  });

export const showNoteWithoutParams = async () =>
  // @ts-expect-error the route declares {noteId}
  fetcher({
    plugin: "@acme/notes",
    method: "get",
    module: "notes",
    path: "/{noteId}",
  });
`;

/** The refs `--declare-permission` declared, typed: an undeclared one is not there. */
const PERMISSION_REFS = `import type { AdminStaffPermissionRef } from "@vitnode/core/lib/staff-permissions";

import { staffPermissions } from "@/staff-permissions";

export const declared: AdminStaffPermissionRef[] = [
  staffPermissions.admin.notes.canView,
  staffPermissions.admin.notes.canDelete,
  staffPermissions.admin.notes.canPublish,
];

// @ts-expect-error notes.can_archive was never declared
export const undeclared = staffPermissions.admin.notes.canArchive;
`;

beforeAll(async () => {
  if (
    !existsSync(join(packageRoot, "dist", "src", "api", "lib", "plugin.d.ts"))
  ) {
    throw new Error(
      "@vitnode/core is not built: run `npx tsdown` in packages/vitnode first.",
    );
  }

  root = realpathSync(mkdtempSync(join(tmpdir(), "vitnode-generate-compile-")));
  linkDependencies();
  const { pluginPackageExports, pluginRouteScaffold } = (await import(
    pathToFileURL(
      join(creator, "src", "plugin", "create", "route-templates.ts"),
    ).href
  )) as {
    pluginPackageExports: () => Record<string, unknown>;
    pluginRouteScaffold: (name: string) => Record<string, string>;
  };
  cpSync(join(creator, "copy-of-vitnode-plugin", "root"), root, {
    recursive: true,
  });
  for (const [file, content] of Object.entries(
    pluginRouteScaffold("@acme/notes"),
  )) {
    write(file, content);
  }
  write(
    "package.json",
    JSON.stringify({
      dependencies: { "@vitnode/core": "workspace:*" },
      exports: pluginPackageExports(),
      name: "@acme/notes",
      type: "module",
      version: "0.1.0",
    }),
  );
  writePluginManifest(root);
  writePluginApiRegistry(root);

  await generate("module", "notes");
  await generate("route", "notes/show", "--path", "/{noteId}");
  await generate(
    "route",
    "notes/archive",
    "--method",
    "post",
    "--path",
    "/{noteId}/archive",
    "--id-type",
    "number",
  );
  await generate("service", "notes");
  await generate(
    "resource",
    "tasks",
    "--kind",
    "api",
    "--fields",
    "title:string,done?:boolean,rank:int",
  );
  await generate(
    "resource",
    "notes",
    "--kind",
    "api",
    "--admin",
    "--id-type",
    "number",
    "--permission-module",
    "notes",
    "--declare-permission",
    "--parents",
  );
  await generate(
    "route",
    "admin/notes/publish",
    "--method",
    "post",
    "--path",
    "/{id}/publish",
    "--permission",
    "notes.can_publish",
    "--declare-permission",
  );
  await generate(
    "resource",
    "articles",
    "--kind",
    "content",
    "--fields",
    "title:text,body:richText,pinned?:boolean",
  );
  write("src/fetcher-calls.ts", FETCHER_CALLS);
  write("src/permission-refs.ts", PERMISSION_REFS);
}, 120_000);

afterAll(() => {
  if (root !== undefined) rmSync(root, { force: true, recursive: true });
});

describe("a plugin grown by vitnode generate", () => {
  it("type checks, typed staff permission refs and fetcher calls included", () => {
    const result = spawnSync(
      join(packageRoot, "node_modules", ".bin", "tsc"),
      [
        "--noEmit",
        "-p",
        "tsconfig.build.json",
        "--declaration",
        "false",
        "--declarationMap",
        "false",
        "--emitDeclarationOnly",
        "false",
      ],
      { cwd: root, encoding: "utf8" },
    );

    expect({ output: result.stdout, status: result.status }).toEqual({
      output: "",
      status: 0,
    });
  }, 120_000);

  it.each([
    ["get", "/"],
    ["get", "/1"],
    ["post", "/"],
    ["patch", "/1"],
    ["delete", "/1"],
  ])(
    "answers %s %s of a generated resource with 501 until implemented",
    async (method, path) => {
      const jiti = createJiti(import.meta.url, {
        alias: { "@/": `${join(root, "src")}/` },
        interopDefault: false,
        moduleCache: false,
      });
      const { tasksModule } = await jiti.import<{
        tasksModule: {
          hono: {
            request: (path: string, init?: RequestInit) => Promise<Response>;
          };
        };
      }>(join(root, "src/api/modules/tasks/tasks.module.ts"));

      const response = await tasksModule.hono.request(path, {
        body:
          method === "post" || method === "patch"
            ? JSON.stringify({ rank: 1, title: "Write tests" })
            : undefined,
        headers: { "content-type": "application/json" },
        method: method.toUpperCase(),
      });

      expect(response.status).toBe(501);
      await expect(response.json()).resolves.toEqual({
        error: "not_implemented",
        message: expect.stringContaining("is not implemented yet") as string,
      });
    },
  );
});
