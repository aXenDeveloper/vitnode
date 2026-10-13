import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type {
  PermissionsStaffArgs,
  PermissionStaffCatalogEntry,
  PermissionStaffType,
} from "@/api/lib/permission-staff";

import { findModerationScope } from "@/api/lib/moderation/registry";
import { isModerationResourceId } from "@/api/lib/moderation/scopes";
import {
  staffPermissionKey,
  staffScopeCovers,
} from "@/api/lib/staff-permission";

export type StaffGrantIssue =
  | { dependency: string; key: string; type: "dependency_scope" }
  | { expected: string; key: string; type: "wrong_family" }
  | { ids: string[]; key: string; type: "invalid_resource" }
  | { ids: string[]; key: string; type: "unknown_resource" }
  | { key: string; type: "empty_selection" }
  | { key: string; type: "missing_scope" }
  | { key: string; type: "unexpected_scope" };

export class StaffGrantValidationError extends HTTPException {
  constructor(issues: StaffGrantIssue[]) {
    super(400, {
      message: "The submitted permissions are not valid.",
      res: Response.json(
        { error: "invalid_permissions", issues },
        { status: 400 },
      ),
    });
    this.issues = issues;
  }

  readonly issues: StaffGrantIssue[];
}

interface CatalogEntry {
  dependsOn: string[];
  scope?: string;
}

const catalogIndex = (
  catalog: readonly PermissionStaffCatalogEntry[],
  type: PermissionStaffType,
) => {
  const index = new Map<string, CatalogEntry>();
  for (const plugin of catalog) {
    for (const [module, entries] of Object.entries(plugin[type])) {
      for (const entry of entries) {
        index.set(
          staffPermissionKey({
            module,
            permission: entry.permission,
            plugin: plugin.pluginId,
          }),
          {
            dependsOn: entry.dependsOn.map(dependency =>
              staffPermissionKey({
                module,
                permission: dependency,
                plugin: plugin.pluginId,
              }),
            ),
            scope: entry.scope,
          },
        );
      }
    }
  }

  return index;
};

export const sanitizeStaffGrants = async (
  c: Context,
  {
    permissions,
    type,
  }: { permissions: PermissionsStaffArgs[]; type: PermissionStaffType },
): Promise<PermissionsStaffArgs[]> => {
  const index = catalogIndex(c.get("core").permissionStaff, type);
  const registry = c.get("core").moderation;
  const issues: StaffGrantIssue[] = [];

  const granted = new Map<string, PermissionsStaffArgs>();
  for (const permission of permissions) {
    const key = staffPermissionKey(permission);
    const entry = index.get(key);
    if (!entry || granted.has(key)) continue;

    const base = {
      module: permission.module,
      permission: permission.permission,
      plugin: permission.plugin,
    };

    if (!entry.scope) {
      if (permission.scope) issues.push({ key, type: "unexpected_scope" });
      granted.set(key, base);
      continue;
    }

    const scope = permission.scope;
    if (!scope) {
      issues.push({ key, type: "missing_scope" });
      continue;
    }
    if (scope.family !== entry.scope) {
      issues.push({ expected: entry.scope, key, type: "wrong_family" });
      continue;
    }
    if (scope.mode === "all") {
      granted.set(key, {
        ...base,
        scope: { family: scope.family, mode: "all" },
      });
      continue;
    }

    const ids = [...new Set(scope.ids)];
    if (ids.length === 0) {
      issues.push({ key, type: "empty_selection" });
      continue;
    }
    const malformed = ids.filter(id => !isModerationResourceId(id));
    if (malformed.length > 0) {
      issues.push({ ids: malformed, key, type: "invalid_resource" });
      continue;
    }
    granted.set(key, {
      ...base,
      scope: { family: scope.family, ids: ids.sort(), mode: "selected" },
    });
  }

  const selectedByFamily = new Map<string, Set<string>>();
  for (const grant of granted.values()) {
    if (grant.scope?.mode !== "selected") continue;
    const ids = selectedByFamily.get(grant.scope.family) ?? new Set<string>();
    for (const id of grant.scope.ids) ids.add(id);
    selectedByFamily.set(grant.scope.family, ids);
  }
  for (const [family, ids] of selectedByFamily) {
    const scope = findModerationScope(registry, family);
    const found = new Set(
      scope
        ? (await scope.definition.find(c, [...ids])).map(item => item.id)
        : [],
    );
    for (const [key, grant] of granted) {
      if (grant.scope?.mode !== "selected" || grant.scope.family !== family) {
        continue;
      }
      const missing = grant.scope.ids.filter(id => !found.has(id));
      if (missing.length > 0) {
        issues.push({ ids: missing, key, type: "unknown_resource" });
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...granted.keys()]) {
      const dependencies = index.get(key)?.dependsOn ?? [];
      if (dependencies.some(dependency => !granted.has(dependency))) {
        granted.delete(key);
        changed = true;
      }
    }
  }

  for (const [key, grant] of granted) {
    for (const dependency of index.get(key)?.dependsOn ?? []) {
      const held = granted.get(dependency);
      if (held && !staffScopeCovers(held.scope, grant.scope)) {
        issues.push({ dependency, key, type: "dependency_scope" });
      }
    }
  }

  if (issues.length > 0) throw new StaffGrantValidationError(issues);

  return [...granted.values()];
};

export const staffGrantsWithinCeiling = (
  requested: readonly PermissionsStaffArgs[],
  ceiling: readonly PermissionsStaffArgs[],
): boolean =>
  requested.every(grant =>
    ceiling.some(
      held =>
        staffPermissionKey(held) === staffPermissionKey(grant) &&
        staffScopeCovers(held.scope, grant.scope),
    ),
  );
