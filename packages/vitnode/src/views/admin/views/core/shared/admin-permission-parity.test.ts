import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CONFIG_PLUGIN } from "@/config";

import {
  ADMIN_ROLE_PERMISSIONS,
  ADMIN_USER_PERMISSIONS,
  adminStaffPermissions,
  staffPermissionModuleFor,
} from "./admin-permissions";

const here = dirname(fileURLToPath(import.meta.url));
const apiModules = resolve(here, "../../../../../api/modules/admin");

const sourcesIn = (module: string): { file: string; source: string }[] => {
  const directory = join(apiModules, module, "routes");

  return readdirSync(directory)
    .filter(name => name.endsWith(".route.ts"))
    .sort()
    .map(file => ({
      file,
      source: readFileSync(join(directory, file), "utf8"),
    }));
};

/** `adminStaffPermission: { module: "users", permission: "can_view" }`. */
const DECLARED =
  /adminStaffPermission:\s*\{\s*module:\s*"([^"]+)",\s*permission:\s*"([^"]+)"\s*\}/;

/** The declaration on each route file that has one, by file name. */
const declarationsIn = (module: string): Map<string, string> =>
  new Map(
    sourcesIn(module).flatMap(({ file, source }) => {
      const match = DECLARED.exec(source);

      return match ? [[file, `${match[1]}:${match[2]}`] as const] : [];
    }),
  );

/**
 * `assertStaffPermission(c, { ..., module: staffPermissionModuleByType[type],
 * permission: "can_edit" })` - the staff module's in-handler check.
 */
const ASSERTED =
  /assertStaffPermission\(c,\s*\{[\s\S]*?module:\s*staffPermissionModuleByType\[type\][\s\S]*?permission:\s*"([^"]+)"/;

const assertionsIn = (module: string): Map<string, string> =>
  new Map(
    sourcesIn(module).flatMap(({ file, source }) => {
      const match = ASSERTED.exec(source);

      return match ? [[file, match[1]] as const] : [];
    }),
  );

/** A tuple in the `module:permission` spelling the scans produce. */
const key = ({
  module,
  permission,
}: {
  module: string;
  permission: string;
}): string => `${module}:${permission}`;

describe("the scan is reading real declarations", () => {
  it("finds the five users routes that declare one", () => {
    expect([...declarationsIn("users").keys()]).toEqual([
      "create.route.ts",
      "list.route.ts",
      "show.route.ts",
      "update.route.ts",
      "verify-email.route.ts",
    ]);
  });

  it("finds the three roles routes that declare one", () => {
    expect([...declarationsIn("roles").keys()]).toEqual([
      "create.route.ts",
      "delete.route.ts",
      "update.route.ts",
    ]);
  });

  it("finds the two staff lists, and the four in-handler checks", () => {
    expect([...declarationsIn("staff").keys()]).toEqual([
      "admins.route.ts",
      "moderators.route.ts",
    ]);
    expect([...assertionsIn("staff").keys()]).toEqual([
      "create.route.ts",
      "delete.route.ts",
      "show-permissions.route.ts",
      "update-permissions.route.ts",
    ]);
  });
});

describe("the users screens name the API's own permissions", () => {
  const declared = declarationsIn("users");

  it.each([
    ["list.route.ts", "view"],
    ["show.route.ts", "view"],
    ["create.route.ts", "create"],
    ["update.route.ts", "edit"],
    ["verify-email.route.ts", "edit"],
  ] as const)("%s is %s", (file, tuple) => {
    expect(declared.get(file)).toBe(key(ADMIN_USER_PERMISSIONS[tuple]));
  });

  it("declares can_edit_admin under the same module as can_edit", () => {
    // The elevated pair is enforced by `assertCanEditAdminTarget` inside the
    // handler rather than by a route declaration, so the *module* is what can be
    // checked against the API here - and it has to match, or the gate names a
    // module the staff catalog has never heard of.
    expect(ADMIN_USER_PERMISSIONS.editAdmin.module).toBe(
      ADMIN_USER_PERMISSIONS.edit.module,
    );
    expect(ADMIN_USER_PERMISSIONS.editAdmin.permission).toBe("can_edit_admin");
  });
});

describe("the roles screen names the API's own permissions", () => {
  const declared = declarationsIn("roles");

  it.each([
    ["create.route.ts", "create"],
    ["update.route.ts", "edit"],
    ["delete.route.ts", "delete"],
  ] as const)("%s is %s", (file, tuple) => {
    expect(declared.get(file)).toBe(key(ADMIN_ROLE_PERMISSIONS[tuple]));
  });

  it("gates the list on the frontend only, because the API does not", () => {
    // `listRolesAdminRoute` declares no `adminStaffPermission`, deliberately: a
    // role *picker* has to work for an administrator who cannot open the roles
    // *screen*. So `roles.can_view` decides which page is reachable and nothing
    // else, and this says so on purpose rather than by omission.
    expect(declared.has("list.route.ts")).toBe(false);
    expect(ADMIN_ROLE_PERMISSIONS.view).toEqual({
      module: "roles",
      permission: "can_view",
      plugin: CONFIG_PLUGIN.pluginId,
    });
  });

  it("declares both elevated permissions under the roles module", () => {
    expect(ADMIN_ROLE_PERMISSIONS.editAdmin.module).toBe("roles");
    expect(ADMIN_ROLE_PERMISSIONS.deleteAdmin.module).toBe("roles");
  });
});

describe("the staff screens name the API's own permissions", () => {
  const declared = declarationsIn("staff");
  const asserted = assertionsIn("staff");

  it.each([
    ["admin", "admins.route.ts"],
    ["moderator", "moderators.route.ts"],
  ] as const)("the %s list is its module's can_view", (type, file) => {
    expect(declared.get(file)).toBe(key(adminStaffPermissions(type).view));
  });

  it.each([
    ["create.route.ts", "create"],
    ["update-permissions.route.ts", "edit"],
    ["show-permissions.route.ts", "edit"],
    ["delete.route.ts", "delete"],
  ] as const)("%s asserts can_%s", (file, tuple) => {
    // The handler checks `staffPermissionModuleByType[type]`, so the *module* is
    // whichever group the path named; what this pins is the permission half,
    // which the frontend spells out.
    expect(asserted.get(file)).toBe(
      adminStaffPermissions("admin")[tuple].permission,
    );
  });

  it("maps the two types the way the API's own table does", () => {
    const schema = readFileSync(
      join(apiModules, "staff/lib/schema.ts"),
      "utf8",
    );

    // `staffPermissionModuleByType` cannot be imported into a browser bundle -
    // it lives beside zod-openapi and the route tree - so the frontend restates
    // it. This is the only place the restatement is checked.
    expect(schema).toContain(`admin: "${staffPermissionModuleFor("admin")}"`);
    expect(schema).toContain(
      `moderator: "${staffPermissionModuleFor("moderator")}"`,
    );
  });

  it.each(["admin", "moderator"] as const)(
    "puts all four %s permissions under one module",
    type => {
      const permissions = adminStaffPermissions(type);

      expect([
        ...new Set(Object.values(permissions).map(one => one.module)),
      ]).toEqual([staffPermissionModuleFor(type)]);
      expect(Object.values(permissions).map(one => one.permission)).toEqual([
        "can_create",
        "can_delete",
        "can_edit",
        "can_view",
      ]);
    },
  );

  it("keeps the two groups apart, so one cannot manage the other", () => {
    expect(adminStaffPermissions("admin").edit).not.toEqual(
      adminStaffPermissions("moderator").edit,
    );
  });
});

describe("every tuple is a core permission", () => {
  it.each([
    ...Object.entries(ADMIN_USER_PERMISSIONS),
    ...Object.entries(ADMIN_ROLE_PERMISSIONS),
    ...Object.entries(adminStaffPermissions("admin")),
    ...Object.entries(adminStaffPermissions("moderator")),
  ])("%s names @vitnode/core", (_name, permission) => {
    // A permission granted under core must not open a plugin's page, and the
    // reverse: a core screen naming a plugin id would check a grant nobody has.
    expect(permission.plugin).toBe(CONFIG_PLUGIN.pluginId);
  });
});
