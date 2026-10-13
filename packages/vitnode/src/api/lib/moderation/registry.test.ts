import { describe, expect, it } from "vitest";

import type { PermissionStaffCatalogEntry } from "../permission-staff";
import type { ModerationReportTargetDefinition } from "./targets";

import { normalizePermissionStaffModules } from "../permission-staff";
import {
  validateModerationRegistry,
  withModerationPermissions,
} from "./registry";
import { defineModerationScope, ModerationRegistryError } from "./scopes";
import { defineReportTarget } from "./targets";

const FORUM = "@vitnode/forum";
const FAMILY = "forum.section";

const action = {
  available: () => true,
  permission: "can_hide",
  run: async () => Promise.resolve(null),
};

const target = (
  overrides: Partial<ModerationReportTargetDefinition> = {},
): ModerationReportTargetDefinition =>
  defineReportTarget({
    capture: async () => Promise.resolve(null),
    current: async () => Promise.resolve(null),
    label: "Topic",
    parseId: value => value,
    permissionModule: "topics",
    resolveScope: async () => Promise.resolve(""),
    scope: FAMILY,
    type: "forum.topic",
    ...overrides,
  });

const scope = defineModerationScope({
  find: async () => Promise.resolve([]),
  id: FAMILY,
  label: "Section",
  list: async () => Promise.resolve({ items: [], nextCursor: null }),
});

describe("withModerationPermissions", () => {
  it("generates view, manage and note permissions, scoped like the target, without hiding", () => {
    expect(withModerationPermissions(undefined, [target()])).toEqual({
      moderator: {
        topics: [
          { permission: "can_view_reports", scope: FAMILY },
          {
            dependsOn: ["can_view_reports"],
            permission: "can_manage_reports",
            scope: FAMILY,
          },
          {
            dependsOn: ["can_manage_reports"],
            permission: "can_edit_notes",
            scope: FAMILY,
          },
          {
            dependsOn: ["can_manage_reports"],
            permission: "can_delete_notes",
            scope: FAMILY,
          },
        ],
      },
    });
  });

  it.each(["hide", "unhide"] as const)(
    "adds view hidden and hide when the target can %s",
    name => {
      const generated = withModerationPermissions(undefined, [
        target({ actions: { [name]: action } }),
      ]);

      expect(generated?.moderator?.topics).toEqual(
        expect.arrayContaining([
          { permission: "can_view_hidden", scope: FAMILY },
          {
            dependsOn: ["can_view_hidden"],
            permission: "can_hide",
            scope: FAMILY,
          },
        ]),
      );
    },
  );

  it("leaves an unscoped target's permissions unscoped", () => {
    const generated = withModerationPermissions(undefined, [
      target({ resolveScope: undefined, scope: undefined }),
    ]);

    expect(generated?.moderator?.topics).toEqual([
      { permission: "can_view_reports" },
      { dependsOn: ["can_view_reports"], permission: "can_manage_reports" },
      { dependsOn: ["can_manage_reports"], permission: "can_edit_notes" },
      { dependsOn: ["can_manage_reports"], permission: "can_delete_notes" },
    ]);
  });

  it.each([
    ["by default", undefined],
    ["when listed as declared", new Set(["topics"])],
  ])("keeps a module the plugin declared itself %s", (_label, declared) => {
    const permissionStaff = { moderator: { topics: ["can_view_reports"] } };

    expect(
      withModerationPermissions(permissionStaff, [target()], declared),
    ).toEqual(permissionStaff);
  });

  it("merges into a generated module, keeping its entries and skipping duplicates", () => {
    const generated = withModerationPermissions(
      {
        moderator: {
          topics: [
            { permission: "can_edit", scope: FAMILY },
            { permission: "can_view_reports", scope: FAMILY },
          ],
        },
      },
      [target()],
      new Set(),
    );

    expect(generated?.moderator?.topics).toEqual([
      { permission: "can_edit", scope: FAMILY },
      { permission: "can_view_reports", scope: FAMILY },
      {
        dependsOn: ["can_view_reports"],
        permission: "can_manage_reports",
        scope: FAMILY,
      },
      {
        dependsOn: ["can_manage_reports"],
        permission: "can_edit_notes",
        scope: FAMILY,
      },
      {
        dependsOn: ["can_manage_reports"],
        permission: "can_delete_notes",
        scope: FAMILY,
      },
    ]);
  });
});

describe("validateModerationRegistry", () => {
  const catalog = (
    entry: Partial<PermissionStaffCatalogEntry> = {},
  ): PermissionStaffCatalogEntry[] => [
    { admin: {}, moderator: {}, pluginId: FORUM, ...entry },
  ];

  it("accepts scopes, targets and scoped moderator permissions that line up", () => {
    const registry = validateModerationRegistry({
      catalog: catalog({
        moderator: normalizePermissionStaffModules({
          topics: [{ permission: "can_view_reports", scope: FAMILY }],
        }),
      }),
      scopes: [{ definition: scope, pluginId: FORUM }],
      targets: [{ definition: target(), pluginId: FORUM }],
    });

    expect(registry.targets.map(entry => entry.definition.type)).toEqual([
      "forum.topic",
    ]);
  });

  it.each<[string, Parameters<typeof validateModerationRegistry>[0]]>([
    [
      "a scoped admin permission",
      {
        catalog: catalog({
          admin: normalizePermissionStaffModules({
            topics: [{ permission: "can_edit", scope: FAMILY }],
          }),
        }),
        scopes: [{ definition: scope, pluginId: FORUM }],
        targets: [],
      },
    ],
    [
      "a moderator permission scoped by an unknown family",
      {
        catalog: catalog({
          moderator: normalizePermissionStaffModules({
            topics: [{ permission: "can_view_reports", scope: "forum.nope" }],
          }),
        }),
        scopes: [{ definition: scope, pluginId: FORUM }],
        targets: [],
      },
    ],
    [
      "a target scoped by an unknown family",
      {
        catalog: catalog(),
        scopes: [],
        targets: [{ definition: target(), pluginId: FORUM }],
      },
    ],
    [
      "a family registered twice",
      {
        catalog: catalog(),
        scopes: [
          { definition: scope, pluginId: FORUM },
          { definition: scope, pluginId: "@vitnode/other" },
        ],
        targets: [],
      },
    ],
    [
      "a target type registered twice",
      {
        catalog: catalog(),
        scopes: [{ definition: scope, pluginId: FORUM }],
        targets: [
          { definition: target(), pluginId: FORUM },
          { definition: target(), pluginId: "@vitnode/other" },
        ],
      },
    ],
  ])("rejects %s", (_label, input) => {
    expect(() => validateModerationRegistry(input)).toThrow(
      ModerationRegistryError,
    );
  });
});

describe("defineReportTarget", () => {
  it("requires resolveScope on a scoped target", () => {
    expect(() => target({ resolveScope: undefined })).toThrow(
      ModerationRegistryError,
    );
  });
});
