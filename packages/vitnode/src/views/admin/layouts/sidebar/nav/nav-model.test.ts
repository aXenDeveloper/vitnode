import { describe, expect, it } from "vitest";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { VitNodeConfig } from "@/vitnode.config";

import { EMPTY_STAFF_PERMISSION_SET } from "@/api/lib/staff-permission";

import type { AdminNavTranslator } from "./nav-model";

import {
  adminNavBundle,
  adminNavDeclarations,
  adminNavNamespaces,
  buildAdminNav,
  resolveAdminNav,
} from "./nav-model";

const CORE = "@vitnode/core";

const t: AdminNavTranslator = Object.assign((key: string): string => key, {
  has: () => false,
});

const config = (plugins: VitNodeConfig["plugins"] = []): VitNodeConfig =>
  ({ plugins }) as unknown as VitNodeConfig;

const root: StaffPermissionSet = { root: true, permissions: [] };

const only = (
  ...permissions: { module: string; permission: string; plugin?: string }[]
): StaffPermissionSet => ({
  root: false,
  permissions: permissions.map(({ module, permission, plugin }) => ({
    module,
    permission,
    plugin: plugin ?? CORE,
  })),
});

const groupIds = (nav: ReturnType<typeof buildAdminNav>): string[] =>
  nav.map(group => group.id);

const hrefs = (nav: ReturnType<typeof buildAdminNav>): string[] =>
  nav.flatMap(group =>
    group.items.flatMap(item => [
      item.href,
      ...(item.items ?? []).map(subItem => subItem.href),
    ]),
  );

describe("the core group", () => {
  it("gives a root admin every core screen", () => {
    const nav = buildAdminNav({
      permissions: root,
      t,
      vitNodeConfig: config(),
    });

    expect(groupIds(nav)).toEqual(["core"]);
    expect(hrefs(nav)).toEqual([
      "/admin/core/",
      "/admin/core/system",
      "/admin/core/system/integrations",
      "/admin/core/system/files",
      "/admin/core/users",
      "/admin/core/users",
      "/admin/core/users/roles",
      "/admin/core/staff",
      "/admin/core/staff/moderators",
      "/admin/core/staff/admins",
      "/admin/core/advanced",
      "/admin/core/advanced/search",
      "/admin/core/advanced/cron",
      "/admin/core/advanced/queue",
    ]);
  });

  it("leaves an admin with no permissions only the dashboard", () => {
    const nav = buildAdminNav({
      permissions: EMPTY_STAFF_PERMISSION_SET,
      t,
      vitNodeConfig: config(),
    });

    expect(hrefs(nav)).toEqual(["/admin/core/"]);
  });

  it("keeps a parent only for the sub-items the admin may see", () => {
    const nav = buildAdminNav({
      permissions: only({ module: "roles", permission: "can_view" }),
      t,
      vitNodeConfig: config(),
    });

    expect(hrefs(nav)).toEqual([
      "/admin/core/",
      "/admin/core/users",
      "/admin/core/users/roles",
    ]);
  });

  it("matches a permission on all three of plugin, module and permission", () => {
    const wrongPlugin = buildAdminNav({
      permissions: only({
        module: "roles",
        permission: "can_view",
        plugin: "@vitnode/blog",
      }),
      t,
      vitNodeConfig: config(),
    });

    expect(hrefs(wrongPlugin)).toEqual(["/admin/core/"]);

    const wrongPermission = buildAdminNav({
      permissions: only({ module: "roles", permission: "can_edit" }),
      t,
      vitNodeConfig: config(),
    });

    expect(hrefs(wrongPermission)).toEqual(["/admin/core/"]);
  });

  it("translates every title through the translator it was given", () => {
    const [core] = buildAdminNav({
      permissions: root,
      t,
      vitNodeConfig: config(),
    });

    expect(core.title).toBe("admin.global.nav.core");
    expect(core.items[0].title).toBe("admin.global.nav.dashboard");
    expect(core.items[1].items?.[0].title).toBe(
      "admin.global.nav.system.integrations",
    );
  });
});

describe("plugin groups", () => {
  const contentType = ({
    enabled = true,
    id = "example.article",
    path = "example/articles",
    permissionModule = "content_example_article",
  } = {}) => ({
    definition: {
      admin: { navigation: { enabled }, path },
      id,
      permissionModule,
    },
  });

  const plugin = (
    pluginId: string,
    extra: Record<string, unknown> = {},
  ): VitNodeConfig["plugins"][number] => ({ pluginId, ...extra });

  it("gives every content type a nav item pointing into the Content Engine", () => {
    const nav = buildAdminNav({
      permissions: root,
      t,
      vitNodeConfig: config([
        plugin("@vitnode/example", { contentTypes: [contentType()] }),
      ]),
    });

    expect(groupIds(nav)).toEqual(["core", "@vitnode/example"]);
    expect(hrefs(nav)).toContain("/admin/content/example/articles");
  });

  it("omits a content type that opted out of navigation", () => {
    const nav = buildAdminNav({
      permissions: root,
      t,
      vitNodeConfig: config([
        plugin("@vitnode/example", {
          contentTypes: [contentType({ enabled: false })],
        }),
      ]),
    });

    expect(groupIds(nav)).toEqual(["core"]);
  });

  it("hides a content type the admin may not view, and its group with it", () => {
    const vitNodeConfig = config([
      plugin("@vitnode/example", { contentTypes: [contentType()] }),
    ]);

    expect(
      groupIds(
        buildAdminNav({
          permissions: EMPTY_STAFF_PERMISSION_SET,
          t,
          vitNodeConfig,
        }),
      ),
    ).toEqual(["core"]);

    expect(
      groupIds(
        buildAdminNav({
          permissions: only({
            module: "content_example_article",
            permission: "can_view",
            plugin: "@vitnode/example",
          }),
          t,
          vitNodeConfig,
        }),
      ),
    ).toEqual(["core", "@vitnode/example"]);
  });

  it("carries a declared entry's href, target and permission", () => {
    const nav = buildAdminNav({
      permissions: only({
        module: "reports",
        permission: "can_view",
        plugin: "@vitnode/example",
      }),
      t,
      vitNodeConfig: config([
        plugin("@vitnode/example", {
          admin: {
            nav: [
              {
                href: "https://status.example.com",
                id: "status",
                isOpenInNewTab: true,
                permission: { module: "reports", permission: "can_view" },
              },
              {
                href: "/admin/example/secrets",
                id: "secrets",
                permission: { module: "secrets", permission: "can_view" },
              },
            ],
          },
        }),
      ]),
    });

    const [, example] = nav;

    expect(example.items).toEqual([
      {
        href: "https://status.example.com",
        icon: undefined,
        isOpenInNewTab: true,
        title: "@vitnode/example.admin.nav.status",
      },
    ]);
  });

  it("namespaces a declared permission with the plugin that declared it", () => {
    const vitNodeConfig = config([
      plugin("@vitnode/example", {
        admin: {
          nav: [
            {
              href: "/admin/example/reports",
              id: "reports",
              permission: { module: "reports", permission: "can_view" },
            },
          ],
        },
      }),
    ]);

    // The same module and permission, granted under core rather than under the
    // plugin, must not open the plugin's screen.
    expect(
      groupIds(
        buildAdminNav({
          permissions: only({ module: "reports", permission: "can_view" }),
          t,
          vitNodeConfig,
        }),
      ),
    ).toEqual(["core"]);
  });
});

describe("the two stages", () => {
  it("declares the whole tree without a permission set or a translator", () => {
    const declarations = adminNavDeclarations(config());

    expect(declarations.map(group => group.id)).toEqual(["core"]);
    // Untranslated: a key and where to load it from, not a string a reader
    // would see.
    expect(declarations[0].title).toEqual({
      key: "admin.global.nav.core",
      kind: "key",
      namespace: "admin.global",
    });
  });

  it("declares hidden entries too - filtering is the second stage's job", () => {
    const [core] = adminNavDeclarations(config());
    const staff = core.items.find(item => item.href === "/admin/core/staff");

    expect(staff?.items).toHaveLength(2);
  });

  it("is the same answer whether the stages are run together or apart", () => {
    const vitNodeConfig = config([
      {
        pluginId: "@vitnode/example",
        admin: { nav: [{ href: "/admin/example", id: "home" }] },
      },
    ]);
    const permissions = root;

    expect(
      resolveAdminNav({
        declarations: adminNavDeclarations(vitNodeConfig),
        permissions,
        t,
      }),
    ).toEqual(buildAdminNav({ permissions, t, vitNodeConfig }));
  });

  it("defers a content type's noun to the second stage", () => {
    const [, example] = adminNavDeclarations(
      config([
        {
          pluginId: "@vitnode/example",
          contentTypes: [
            {
              definition: {
                admin: {
                  navigation: { enabled: true },
                  path: "example/articles",
                },
                id: "example.article",
                permissionModule: "content_example_article",
              },
            },
          ],
        } as unknown as VitNodeConfig["plugins"][number],
      ]),
    );

    expect(example.items[0].title).toEqual({
      contentTypeId: "example.article",
      kind: "content",
      pluginId: "@vitnode/example",
    });
  });

  it("resolves a content noun from its id when nothing is translated", () => {
    const vitNodeConfig = config([
      {
        pluginId: "@vitnode/example",
        contentTypes: [
          {
            definition: {
              admin: {
                navigation: { enabled: true },
                path: "example/articles",
              },
              id: "example.article",
              permissionModule: "content_example_article",
            },
          },
        ],
      } as unknown as VitNodeConfig["plugins"][number],
    ]);

    const [, example] = buildAdminNav({ permissions: root, t, vitNodeConfig });

    expect(example.items[0].title).toBe("Article");
  });
});

describe("the namespaces a navigation needs", () => {
  const contentType = (id = "example.article", path = "example/articles") => ({
    definition: {
      admin: { navigation: { enabled: true }, path },
      id,
      permissionModule: "content_example_article",
    },
  });

  const plugin = (
    pluginId: string,
    extra: Record<string, unknown> = {},
  ): VitNodeConfig["plugins"][number] => ({ pluginId, ...extra });

  it("asks for the shell's own namespace and nothing else for core", () => {
    expect(adminNavNamespaces(adminNavDeclarations(config()))).toEqual([
      "admin.global",
    ]);
  });

  it("asks for a leaf for the group heading, not the plugin's tree", () => {
    const namespaces = adminNavNamespaces(
      adminNavDeclarations(
        config([plugin("@vitnode/example", { contentTypes: [contentType()] })]),
      ),
    );

    expect(namespaces).toContain("@vitnode/example.title");
    expect(namespaces).not.toContain("@vitnode/example");
  });

  it("asks for the branch a content type's noun is in", () => {
    expect(
      adminNavNamespaces(
        adminNavDeclarations(
          config([
            plugin("@vitnode/example", { contentTypes: [contentType()] }),
          ]),
        ),
      ),
    ).toContain("@vitnode/example.content.article");
  });

  it("asks for one namespace for every hand-declared entry", () => {
    const namespaces = adminNavNamespaces(
      adminNavDeclarations(
        config([
          plugin("@vitnode/example", {
            admin: {
              nav: [
                { href: "/admin/example", id: "overview" },
                {
                  href: "/admin/example/reports",
                  id: "reports",
                  items: [{ href: "/admin/example/reports/new", id: "new" }],
                },
              ],
            },
          }),
        ]),
      ),
    );

    expect(
      namespaces.filter(namespace =>
        namespace.startsWith("@vitnode/example.admin"),
      ),
    ).toEqual(["@vitnode/example.admin.nav"]);
  });

  it("is deduplicated and deterministically ordered", () => {
    const declarations = adminNavDeclarations(
      config([
        plugin("@vitnode/blog", {
          contentTypes: [contentType("blog.post", "blog/posts")],
        }),
        plugin("@vitnode/example", {
          admin: { nav: [{ href: "/admin/example", id: "overview" }] },
          contentTypes: [
            contentType(),
            contentType("example.category", "example/categories"),
          ],
        }),
      ]),
    );

    expect(adminNavNamespaces(declarations)).toEqual([
      "@vitnode/blog.content.post",
      "@vitnode/blog.title",
      "@vitnode/example.admin.nav",
      "@vitnode/example.content.article",
      "@vitnode/example.content.category",
      "@vitnode/example.title",
      "admin.global",
    ]);

    // Order in, order out: the same set whichever way the plugins were listed.
    expect(adminNavNamespaces([...declarations].reverse())).toEqual(
      adminNavNamespaces(declarations),
    );
  });

  /**
   * One value rather than two arguments that have to agree - a host cannot pass
   * a sidebar with a plugin group in it and forget the strings that group needs.
   */
  it("bundles the declarations with the namespaces they need", () => {
    const bundle = adminNavBundle(
      config([plugin("@vitnode/example", { contentTypes: [contentType()] })]),
    );

    expect(bundle.declarations.map(group => group.id)).toEqual([
      "core",
      "@vitnode/example",
    ]);
    expect(bundle.namespaces).toEqual(adminNavNamespaces(bundle.declarations));
  });
});
