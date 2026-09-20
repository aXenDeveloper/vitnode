import { describe, expect, it } from "vitest";

import type { PermissionStaffModulesInput } from "@/api/lib/permission-staff";
import type { VitNodeApiConfig } from "@/vitnode.config";

import { buildApiPlugin } from "@/api/lib/plugin";
import { defineEditablePage } from "@/content/editor/define";

import { globalMiddleware } from "./global.middleware";

const settingsPage = defineEditablePage({
  id: "example:settings",
  permission: { module: "widgets", permission: "can_edit" },
  zones: { sidebar: { allowed: ["core:text"] } },
});

const boot = (moderator?: PermissionStaffModulesInput) =>
  globalMiddleware({
    cacheClient: null,
    dbProvider: {} as VitNodeApiConfig["dbProvider"],
    metadata: { title: "VitNode" },
    plugins: [
      buildApiPlugin({
        pluginId: "@vitnode/example",
        editablePages: [settingsPage],
        permissionStaff: moderator === undefined ? undefined : { moderator },
      }),
    ],
  });

describe("an editable page's permission", () => {
  it("boots when the plugin declares it as a moderator permission", () => {
    expect(() => boot({ widgets: ["can_edit"] })).not.toThrow();
  });

  it("fails boot when the plugin declares no permissions at all", () => {
    expect(() => boot()).toThrow(/permission nobody holds/);
  });

  it("fails boot when the module is declared without that permission", () => {
    expect(() => boot({ widgets: ["can_view"] })).toThrow(/never declares/);
  });
});
