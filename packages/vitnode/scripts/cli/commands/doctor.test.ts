import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runCli } from "../index";
import { createFakeRuntime } from "../testing";

declare global {
  var __vitnodeHandlerCalls: string[] | undefined;
}

let root: string;

const write = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

/** A plugin package's sources, with an API unless `api: false`. */
const source = ({ api = true }: { api?: boolean } = {}) => {
  write(
    "package.json",
    JSON.stringify({
      dependencies: { "@vitnode/core": "workspace:*" },
      exports: { "./*": "./dist/src/*.js" },
      name: "@acme/notes",
      type: "module",
      version: "1.0.0",
    }),
  );
  write("src/config.tsx", "");
  write("tsconfig.json", JSON.stringify({ include: ["types", "src"] }));
  write(
    "dist/src/config.js",
    'export const notesPlugin = () => ({ pluginId: "@acme/notes" });\n',
  );
  if (!api) return;
  write(
    "src/config.api.ts",
    `import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { manifest } from "@/manifest.gen";

export const notesApiPlugin = () => buildApiPlugin({ manifest, modules: [] });

export type VitNodeApiPlugin = ApiPluginContract<ReturnType<typeof notesApiPlugin>>;
`,
  );
  write("types/api-registry.gen.d.ts", "export {};\n");
};

/**
 * Build output, written by hand as plain ESM: `definition` is the object the
 * plugin's `buildApiPlugin` factory returns. `route(...)` and `handler(...)`
 * are in scope; every handler records that it ran, then throws.
 */
const built = (definition: string) => {
  write(
    "dist/src/config.api.js",
    `const handler = name => () => {
  (globalThis.__vitnodeHandlerCalls ??= []).push(name);
  throw new Error(\`\${name} must not run\`);
};
const route = (method, path, permissions) => {
  const built = { route: { method, path }, handler: handler(\`\${method} \${path}\`) };
  if (permissions) {
    Object.defineProperty(built, Symbol.for("vitnode.route.staffPermissions"), { value: permissions });
  }
  return built;
};
const ref = (permission, extra = {}) => ({ module: "notes", permission, plugin: "@acme/notes", ...extra });

export const notesApiPlugin = () => ({ pluginId: "@acme/notes", permissionStaff: { admin: { notes: ["can_view"] }, moderator: {} }, ...${definition} });
`,
  );
};

const run = async (...argv: string[]) => {
  const runtime = createFakeRuntime({ cwd: root });
  const code = await runCli([...argv, "--plain"], runtime);

  return { code, errors: runtime.errors(), output: runtime.output() };
};

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "vitnode-doctor-")));
  globalThis.__vitnodeHandlerCalls = [];
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("vitnode doctor", () => {
  it("passes a plugin whose admin routes are guarded by declared permissions, strict too", async () => {
    source();
    built(
      `{ modules: [{ name: "admin", modules: [{ name: "notes", routes: [route("get", "/", { admin: ref("can_view", { staffType: "admin" }) })] }] }] }`,
    );

    const { code, output } = await run("doctor", "--strict");

    expect(code).toBe(0);
    expect(output).toContain(
      "[OK] Staff permission guards (1 route with declared guards",
    );
    expect(output).toContain("[OK] Endpoints (1 route, no duplicates)");
    expect(output).toContain("[OK] Everything checked is fine");
    expect(output).toContain("declarations only");
  });

  it("fails and blocks the API checks when the plugin is not built", async () => {
    source();
    rmSync(join(root, "dist"), { force: true, recursive: true });

    const { code, errors, output } = await run("doctor");

    expect(code).toBe(1);
    expect(output).toContain("[FAIL] Build output");
    expect(output).toContain(
      "Run vitnode build in the plugin's folder (or pnpm build:plugins), then check again.",
    );
    expect(output).toContain(
      "[BLOCKED] Staff permission guards (not run - Build output failed)",
    );
    expect(errors).toContain("1 plugin with problems: @acme/notes");
  });

  it.each([
    [
      'export const notesApiPlugin = () => { throw new Error("modules must be an array"); };\n',
      "modules must be an array",
    ],
    [
      "export const notesApiPlugin = { pluginId: 1 };\n",
      "dist/src/config.api.js exports no buildApiPlugin({ manifest, ... }) factory.",
    ],
  ])(
    "fails and blocks the API checks on an unreadable API definition: %s",
    async (api, detail) => {
      source();
      write("dist/src/config.api.js", api);

      const { code, output } = await run("doctor");

      expect(code).toBe(1);
      expect(output).toContain("[FAIL] API definition");
      expect(output).toContain(detail);
      expect(output).toContain(
        "[BLOCKED] Endpoints (not run - API definition failed)",
      );
    },
  );

  it("fails on background work registered on a nested module, and says where it belongs", async () => {
    source();
    built(
      `{ modules: [{ name: "admin", modules: [{ name: "notes", cronJobs: [{ name: "cleanup", schedule: "0 * * * *", handler: handler("cleanup") }] }] }] }`,
    );

    const { code, output } = await run("doctor");

    expect(code).toBe(1);
    expect(output).toContain("[FAIL] Background registrations");
    expect(output).toContain(
      '@acme/notes: cronJobs "cleanup" on nested module "admin/notes" never run - buildApiPlugin collects cronJobs from top-level modules only. Move it to buildModule({ cronJobs }) of the top-level module "admin".',
    );
  });

  it.each([
    ["get", "/{id}", "get", "/{noteId}", true],
    ["get", "/{id}", "get", "/:id", true],
    ["get", "/{id}", "GET", "/{id}", true],
    ["get", "/paged", "get", "/{id}", false],
    ["get", "/{id}", "post", "/{id}", false],
  ])(
    "%s %s and %s %s: duplicate %s",
    async (firstMethod, firstPath, secondMethod, secondPath, duplicate) => {
      source();
      built(
        `{ modules: [{ name: "notes", routes: [route(${JSON.stringify(firstMethod)}, ${JSON.stringify(firstPath)}), route(${JSON.stringify(secondMethod)}, ${JSON.stringify(secondPath)})] }] }`,
      );

      const { code, output } = await run("doctor", "--strict");

      expect(code).toBe(duplicate ? 1 : 0);
      expect(output).toContain(
        duplicate
          ? "[FAIL] Endpoints"
          : "[OK] Endpoints (2 routes, no duplicates)",
      );
      if (duplicate) {
        expect(output).toContain(
          `${secondMethod.toUpperCase()} /@acme/notes/notes${secondPath} (module "notes") duplicates ${firstMethod.toUpperCase()} /@acme/notes/notes${firstPath} (module "notes")`,
        );
      }
    },
  );

  it.each([
    {
      guard: `{ admin: ref("can_delete", { staffType: "admin" }) }`,
      message:
        "GET /@acme/notes/admin/notes: adminStaffPermission requires notes.can_delete, which @acme/notes does not declare in its defineStaffPermissions(manifest, { admin }).",
      name: "an undeclared permission",
    },
    {
      guard: `{ admin: ref("can_view", { staffType: "moderator" }) }`,
      message:
        "GET /@acme/notes/admin/notes: adminStaffPermission is given the moderator permission notes.can_view. Pass one from defineStaffPermissions(...).admin instead.",
      name: "a moderator ref as an admin guard",
    },
    {
      guard: `{ admin: ref("can_hide") }`,
      message:
        "GET /@acme/notes/admin/notes: adminStaffPermission requires notes.can_hide, which @acme/notes declares under defineStaffPermissions(manifest, { moderator }), not { admin } - the wrong staff type.",
      name: "a permission declared for the other staff type",
    },
  ])("fails on $name", async ({ guard, message }) => {
    source();
    built(
      `{ permissionStaff: { admin: { notes: ["can_view"] }, moderator: { notes: ["can_hide"] } }, modules: [{ name: "admin", modules: [{ name: "notes", routes: [route("get", "/", ${guard})] }] }] }`,
    );

    const { code, output } = await run("doctor");

    expect(code).toBe(1);
    expect(output).toContain("[FAIL] Staff permission guards");
    expect(output).toContain(message);
  });

  it.each([
    [[], 0],
    [["--strict"], 1],
  ])(
    "warns on an unguarded /admin route: doctor %j exits %i",
    async (flags, exitCode) => {
      source();
      built(
        `{ modules: [{ name: "admin", modules: [{ name: "notes", routes: [route("get", "/")] }] }] }`,
      );

      const { code, output } = await run("doctor", ...flags);

      expect(code).toBe(exitCode);
      expect(output).toContain("[WARN] Staff permission guards");
      expect(output).toContain(
        "GET /@acme/notes/admin/notes is under /admin but declares no adminStaffPermission, so any admin can call it.",
      );
    },
  );

  it("skips the checks a plugin without an API has nothing for, without failing --strict", async () => {
    source({ api: false });

    const { code, output } = await run("doctor", "--strict");

    expect(code).toBe(0);
    expect(output).toContain(
      "[SKIP] Staff permission guards (no API (no src/config.api.ts))",
    );
    expect(output).toContain("[SKIP] API registration (no src/config.api.ts)");
    expect(output).toContain("[SKIP] App registration (no API to register)");
    expect(output).not.toContain("[BLOCKED]");
  });
});

describe("vitnode inspect", () => {
  const definition = `{
    modules: [
      { name: "notes", routes: [route("get", "/{id}")] },
      { name: "admin", modules: [{ name: "notes", routes: [route("delete", "/{id}", { admin: ref("can_view", { staffType: "admin" }) })], queueTasks: [{ name: "nested", handler: handler("nested queue task") }] }] },
    ],
    cronJobs: [{ name: "cleanup", schedule: "0 * * * *", module: "notes", handler: handler("cleanup") }],
    queueTasks: [{ name: "reindex", module: "notes", payload: {}, pluginId: "@acme/notes", handler: handler("reindex") }],
    events: [{ module: "notes", name: "notify-authors", definition: { name: "notes.created", pluginId: "@acme/notes", payload: {} }, handler: handler("notify-authors") }],
    eventDefinitions: [{ name: "notes.created", pluginId: "@acme/notes", payload: {} }],
  }`;

  it.each([
    [
      "routes",
      [
        "DELETE",
        "/@acme/notes/admin/notes/{id}",
        "admin notes.can_view",
        "GET",
        "/@acme/notes/notes/{id}",
      ],
    ],
    [
      "jobs",
      [
        "cron",
        "cleanup",
        "0 * * * *",
        "queue",
        "reindex",
        "payload schema",
        'queueTasks "nested" on nested module "admin/notes" never run',
      ],
    ],
    [
      "events",
      ["event", "notes.created", "notify-authors", "Event definition"],
    ],
  ])(
    "lists %s from the declarations without running a handler",
    async (section, rows) => {
      source();
      built(definition);

      const { code, output } = await run("inspect", section);

      expect(code).toBe(0);
      for (const row of rows) expect(output).toContain(row);
      expect(output).toContain(
        "Read from each plugin's build output; declarations only.",
      );
      expect(globalThis.__vitnodeHandlerCalls).toEqual([]);
    },
  );
});
