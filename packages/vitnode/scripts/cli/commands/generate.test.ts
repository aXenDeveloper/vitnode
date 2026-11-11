import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writePluginManifest } from "../../write-plugin-manifest";
import { unifiedDiff } from "../generate/diff";
import { runCli } from "../index";
import { createFakeRuntime } from "../testing";

const packageRoot = join(import.meta.dirname, "..", "..", "..");
const creator = join(packageRoot, "..", "create-vitnode-app");

let root: string;

const read = (path: string) => readFileSync(join(root, path), "utf8");

const write = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

/** Every file of the plugin, by its posix path - what "nothing changed" compares. */
const snapshot = (dir = root): Record<string, string> =>
  Object.fromEntries(
    readdirSync(dir).flatMap(entry => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return Object.entries(snapshot(path));

      return [
        [
          relative(root, path).split(sep).join(posix.sep),
          readFileSync(path, "utf8"),
        ],
      ];
    }),
  );

const generate = async (...argv: string[]) => {
  const runtime = createFakeRuntime({ cwd: root });
  const code = await runCli(["g", ...argv, "--plain"], runtime);

  return { code, errors: runtime.errors(), output: runtime.output() };
};

/**
 * A plugin exactly as `create-vitnode-app --plugin` scaffolds it, with the
 * manifest `vitnode build` writes - the generator's real starting point.
 */
const scaffold = async () => {
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
};

const staffPermissions = (admin: string) => {
  write(
    "src/staff-permissions.ts",
    `import { defineStaffPermissions } from "@vitnode/core/lib/staff-permissions";

import { manifest } from "@/manifest.gen";

export const staffPermissions = defineStaffPermissions(manifest, {
  admin: ${admin},
});
`,
  );
  write(
    "src/config.api.ts",
    read("src/config.api.ts")
      .replace(
        'import { manifest } from "@/manifest.gen";',
        'import { manifest } from "@/manifest.gen";\nimport { staffPermissions } from "@/staff-permissions";',
      )
      .replace(
        "modules: [helloModule],",
        "modules: [helloModule],\n    permissionStaff: staffPermissions,",
      ),
  );
};

beforeEach(async () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "vitnode-generate-")));
  await scaffold();
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

describe("vitnode generate - registrations", () => {
  it("registers a module in buildApiPlugin and a route in its module", async () => {
    expect((await generate("module", "notes")).code).toBe(0);
    expect(
      (await generate("route", "notes/show", "--path", "/{noteId}")).code,
    ).toBe(0);

    const config = read("src/config.api.ts");
    expect(config).toContain(
      'import { notesModule } from "./api/modules/notes/notes.module";',
    );
    expect(config).toContain("modules: [helloModule, notesModule],");

    const module = read("src/api/modules/notes/notes.module.ts");
    expect(module).toContain(
      'import { showNotesRoute } from "./routes/show.route";',
    );
    expect(module).toContain("routes: [showNotesRoute],");
    expect(read("src/api/modules/notes/routes/show.route.ts")).toContain(
      'path: "/{noteId}"',
    );
  });

  it("creates missing parent modules with --parents and nests each in its parent", async () => {
    expect(
      (await generate("module", "admin/notes/drafts", "--parents")).code,
    ).toBe(0);

    expect(read("src/config.api.ts")).toContain(
      "modules: [helloModule, adminModule],",
    );
    expect(read("src/api/modules/admin/admin.module.ts")).toContain(
      "modules: [adminNotesModule]",
    );
    expect(read("src/api/modules/admin/notes/notes.module.ts")).toContain(
      "modules: [adminNotesDraftsModule]",
    );
    expect(
      existsSync(
        join(root, "src/api/modules/admin/notes/drafts/drafts.module.ts"),
      ),
    ).toBe(true);
  });

  it("generates an empty service factory without touching the module's routes", async () => {
    await generate("module", "notes");
    const before = snapshot();

    expect((await generate("service", "notes")).code).toBe(0);

    const after = snapshot();
    expect(
      Object.keys(after).filter(path => before[path] !== after[path]),
    ).toEqual(["src/api/modules/notes/notes.service.ts"]);
    expect(after["src/api/modules/notes/notes.service.ts"]).toContain(
      "export const createNotesService = (_deps: NotesServiceDeps) => ({",
    );
  });

  it("generates an API resource whose routes map NotImplementedError to 501", async () => {
    const { code } = await generate(
      "resource",
      "tasks",
      "--kind",
      "api",
      "--fields",
      "title:string,done?:boolean",
    );

    expect(code).toBe(0);
    expect(read("src/config.api.ts")).toContain(
      "modules: [helloModule, tasksModule],",
    );
    expect(read("src/api/modules/tasks/tasks.module.ts")).toMatch(
      /routes: \[\s*listTasksRoute,\s*showTasksRoute,\s*createTasksRoute,\s*updateTasksRoute,\s*deleteTasksRoute,?\s*\]/,
    );
    expect(read("src/api/modules/tasks/tasks.service.ts")).toContain(
      "export class TasksNotImplementedError extends Error",
    );
    for (const operation of ["list", "show", "create", "update", "delete"]) {
      const route = read(`src/api/modules/tasks/routes/${operation}.route.ts`);
      expect(route).toMatch(/501: \{\s*content:/);
      expect(route).toContain("if (error instanceof TasksNotImplementedError)");
      expect(route).toContain(
        '{ error: "not_implemented" as const, message: error.message }',
      );
    }
  });

  it("guards an admin API resource with typed refs from a staff permission module it declares", async () => {
    const { code } = await generate(
      "resource",
      "notes",
      "--kind",
      "api",
      "--admin",
      "--permission-module",
      "notes",
      "--declare-permission",
      "--parents",
    );

    expect(code).toBe(0);
    expect(read("src/staff-permissions.ts")).toContain(
      "defineStaffPermissions(manifest, {",
    );
    expect(read("src/config.api.ts")).toContain(
      "permissionStaff: staffPermissions",
    );
    for (const [operation, key] of [
      ["list", "canView"],
      ["show", "canView"],
      ["create", "canCreate"],
      ["update", "canEdit"],
      ["delete", "canDelete"],
    ]) {
      const route = read(
        `src/api/modules/admin/notes/routes/${operation}.route.ts`,
      );
      expect(route).toContain(
        `adminStaffPermission: staffPermissions.admin.notes.${key},`,
      );
      expect(route).toContain(
        'import { staffPermissions } from "@/staff-permissions";',
      );
    }
  });

  it("creates src/staff-permissions.ts for --declare-permission and appends to it next time", async () => {
    expect(
      (
        await generate(
          "route",
          "admin/notes/create",
          "--permission",
          "notes.can_create",
          "--declare-permission",
          "--parents",
        )
      ).code,
    ).toBe(0);
    expect(read("src/staff-permissions.ts")).toContain(
      'admin: { notes: ["can_create"] },',
    );
    expect(
      read("src/api/modules/admin/notes/routes/create.route.ts"),
    ).toContain(
      "adminStaffPermission: staffPermissions.admin.notes.canCreate,",
    );
    expect(JSON.parse(read("src/locales/en.json"))).toMatchObject({
      "@acme/notes:notes": "Notes",
      "@acme/notes:notes:can_create": "Create notes",
    });

    expect(
      (
        await generate(
          "route",
          "admin/notes/delete",
          "--permission",
          "notes.can_delete",
          "--declare-permission",
        )
      ).code,
    ).toBe(0);
    expect(read("src/staff-permissions.ts")).toContain(
      'admin: { notes: ["can_create", "can_delete"] },',
    );
    expect(
      read("src/api/modules/admin/notes/routes/delete.route.ts"),
    ).toContain(
      "adminStaffPermission: staffPermissions.admin.notes.canDelete,",
    );
  });

  it("mounts a Content Engine resource in the admin module", async () => {
    const { code } = await generate(
      "resource",
      "articles",
      "--kind",
      "content",
      "--fields",
      "title:text,body:richText",
    );

    expect(code).toBe(0);
    expect(read("src/api/modules/admin/admin.module.ts")).toContain(
      "articlesContent",
    );
    expect(read("src/config.api.ts")).toContain(
      "modules: [helloModule, adminModule],",
    );
    for (const file of [
      "src/content/articles.ts",
      "src/database/articles.ts",
      "src/admin/nav.tsx",
      "src/admin/content.tsx",
    ]) {
      expect(existsSync(join(root, file))).toBe(true);
    }
  });
});

describe("vitnode generate --dry-run", () => {
  it.each([
    [["module", "notes"]],
    [["route", "hello/show", "--path", "/{id}"]],
    [
      [
        "route",
        "admin/notes/create",
        "--permission",
        "notes.can_create",
        "--declare-permission",
        "--parents",
      ],
    ],
    [["resource", "tasks", "--kind", "api", "--fields", "title:string"]],
    [["resource", "articles", "--kind", "content", "--fields", "title:text"]],
  ])(
    "writes nothing and prints the diff the real run applies: %j",
    async argv => {
      const before = snapshot();

      const dry = await generate(...argv, "--dry-run");

      expect(dry.code).toBe(0);
      expect(snapshot()).toEqual(before);
      expect(dry.output).toContain("Nothing was written.");

      expect((await generate(...argv)).code).toBe(0);
      const after = snapshot();
      const changed = Object.keys(after).filter(
        path => before[path] !== after[path],
      );

      expect(changed.length).toBeGreaterThan(0);
      expect(Object.keys(before).filter(path => !(path in after))).toEqual([]);
      for (const path of changed) {
        expect(dry.output).toContain(
          unifiedDiff(path, before[path] ?? null, after[path] ?? "").join("\n"),
        );
        expect(dry.output).toMatch(
          new RegExp(
            `would (?:create|update)\\s+${path.replaceAll(".", "\\.")}`,
          ),
        );
      }
      expect(dry.output.match(/would (?:create|update)/g)).toHaveLength(
        changed.length,
      );
    },
  );
});

describe("vitnode generate - refusals leave the plugin untouched", () => {
  it.each([
    {
      argv: ["module", "hello"],
      details:
        "Declared as helloModule in src/api/modules/hello/hello.module.ts.",
      message: 'Module "hello" already exists.',
    },
    {
      argv: ["route", "hello/list"],
      details:
        'helloRoute in src/api/modules/hello/routes/hello.route.ts (module "hello") answers GET /hello.',
      message: "GET /hello already exists.",
    },
    {
      argv: ["route", "hello/item", "--method", "get", "--path", "/{itemId}"],
      details:
        "Path parameters match whatever their names: /{id} and /{noteId} are the same route.",
      message: "GET /hello/{itemId} already exists.",
      setup: async () => {
        await generate("route", "hello/show", "--path", "/{id}");
      },
    },
    {
      argv: ["route", "hello/show", "--path", "/{id}"],
      details: "The generator never overwrites files.",
      message: "src/api/modules/hello/routes/show.route.ts already exists.",
      setup: () => {
        write("src/api/modules/hello/routes/show.route.ts", "// mine\n");
      },
    },
    {
      argv: ["route", "hello/show", "--path", "/{id}"],
      details: "To wire it by hand:",
      message:
        'Could not tell whether "hello" already exists in src/config.api.ts.',
      setup: () => {
        write(
          "src/api/modules/hello/hello.module.ts",
          read("src/api/modules/hello/hello.module.ts")
            .replace(
              'import { helloRoute } from "./routes/hello.route";',
              'import { helloRoute } from "./routes/hello.route";\n\nconst shared = { routes: [helloRoute] };',
            )
            .replace(
              "routes: [helloRoute],",
              "routes: [helloRoute],\n  ...shared,",
            ),
        );
      },
    },
    {
      argv: ["route", "notes/list", "--parents"],
      details: "...extraModules(): a spread element",
      message:
        'Could not tell whether "notes" already exists in src/config.api.ts.',
      setup: () => {
        write(
          "src/config.api.ts",
          read("src/config.api.ts")
            .replace(
              "modules: [helloModule],",
              "modules: [helloModule, ...extraModules()],",
            )
            .replace(
              "export const notesApiPlugin",
              "const extraModules = () => [];\n\nexport const notesApiPlugin",
            ),
        );
      },
    },
  ])("$message", async ({ argv, details, message, setup }) => {
    await Promise.resolve(setup?.());
    const before = snapshot();

    const { code, errors } = await generate(...argv);

    expect(code).not.toBe(0);
    expect(errors).toContain(message);
    expect(errors).toContain(details);
    expect(snapshot()).toEqual(before);
  });

  it("keeps comments and the rest of the config when it registers a module", async () => {
    const original = `import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { manifest } from "@/manifest.gen";

// The starter module.
import { helloModule } from "./api/modules/hello/hello.module";

/* Mounted in this order. */
export const notesApiPlugin = () =>
  buildApiPlugin({
    manifest,
    // Every module the plugin serves.
    modules: [
      helloModule, // keep first
    ],
    eventDefinitions: [], // none yet
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof notesApiPlugin>
>;
`;
    write("src/config.api.ts", original);

    expect((await generate("module", "notes")).code).toBe(0);

    const diff = unifiedDiff(
      "src/config.api.ts",
      original,
      read("src/config.api.ts"),
    );
    expect(diff.filter(line => /^-(?!--)/.test(line))).toEqual([]);
    expect(diff.filter(line => /^\+(?!\+\+)/.test(line))).toEqual([
      '+import { notesModule } from "./api/modules/notes/notes.module";',
      "+      notesModule,",
    ]);
  });
});

describe("vitnode generate - staff permission diagnostics", () => {
  it.each([
    {
      argv: ["--permission", "notes.can_create"],
      declared: '{ notes: ["can_view"] }',
      details: 'admin: { notes: ["can_create"] }',
      message: "The staff permission notes.can_create is not declared.",
    },
    {
      argv: ["--permission", "notes.can-create", "--declare-permission"],
      declared: '{ notes: ["can_create"] }',
      details:
        "Both become the reference staffPermissions.admin.notes.canCreate, which defineStaffPermissions refuses.",
      message: "notes.can-create collides with the declared notes.can_create.",
    },
  ])("$message", async ({ argv, declared, details, message }) => {
    staffPermissions(declared);
    const before = snapshot();

    const { code, errors } = await generate(
      "route",
      "admin/notes/create",
      "--parents",
      ...argv,
    );

    expect(code).toBe(2);
    expect(errors).toContain(message);
    expect(errors).toContain(details);
    expect(snapshot()).toEqual(before);
  });

  it("guards with the existing typed ref when the permission is declared", async () => {
    staffPermissions('{ notes: ["can_view", "can_create"] }');
    const before = read("src/staff-permissions.ts");

    const { code } = await generate(
      "route",
      "admin/notes/create",
      "--parents",
      "--permission",
      "notes.can_create",
    );

    expect(code).toBe(0);
    expect(read("src/staff-permissions.ts")).toBe(before);
    expect(
      read("src/api/modules/admin/notes/routes/create.route.ts"),
    ).toContain(
      "adminStaffPermission: staffPermissions.admin.notes.canCreate,",
    );
  });
});
