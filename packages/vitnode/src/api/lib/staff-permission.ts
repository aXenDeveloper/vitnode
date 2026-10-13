import type {
  PermissionsStaffArgs,
  PermissionStaffModules,
  PermissionStaffResource,
  PermissionStaffScope,
  StaffPermissionSet,
} from "./permission-staff";

export type StaffPermissionCheck = Omit<PermissionsStaffArgs, "scope"> & {
  resource?: PermissionStaffResource;
};

const sameKey = (
  grant: Omit<PermissionsStaffArgs, "scope">,
  args: Omit<PermissionsStaffArgs, "scope">,
): boolean =>
  grant.plugin === args.plugin &&
  grant.module === args.module &&
  grant.permission === args.permission;

const grantAllows = (
  grant: PermissionsStaffArgs,
  resource: PermissionStaffResource | undefined,
): boolean => {
  if (!grant.scope) return true;
  if (resource && resource.family !== grant.scope.family) return false;
  if (grant.scope.mode === "all") return true;

  return resource !== undefined && grant.scope.ids.includes(resource.id);
};

export const hasStaffPermission = (
  set: StaffPermissionSet,
  { resource, ...args }: StaffPermissionCheck,
): boolean => {
  if (set.root) return true;

  return set.permissions.some(
    grant => sameKey(grant, args) && grantAllows(grant, resource),
  );
};

export const holdsStaffPermission = (
  set: StaffPermissionSet,
  args: Omit<PermissionsStaffArgs, "scope">,
): boolean => set.root || set.permissions.some(grant => sameKey(grant, args));

export const staffPermissionResources = (
  set: StaffPermissionSet,
  args: Omit<PermissionsStaffArgs, "scope">,
  family: string,
): "all" | null | string[] => {
  if (set.root) return "all";

  const ids = new Set<string>();
  for (const grant of set.permissions) {
    if (!sameKey(grant, args)) continue;
    if (!grant.scope) return "all";
    if (grant.scope.family !== family) continue;
    if (grant.scope.mode === "all") return "all";
    for (const id of grant.scope.ids) ids.add(id);
  }

  return ids.size > 0 ? [...ids].sort() : null;
};

export const staffPermissionKey = ({
  plugin,
  module,
  permission,
}: Omit<PermissionsStaffArgs, "scope">): string =>
  `${plugin}:${module}:${permission}`;

export const staffScopeCovers = (
  outer: PermissionStaffScope | undefined,
  inner: PermissionStaffScope | undefined,
): boolean => {
  if (!outer) return true;
  if (!inner) return false;
  if (outer.family !== inner.family) return false;
  if (outer.mode === "all") return true;
  if (inner.mode === "all") return false;

  const allowed = new Set(outer.ids);

  return inner.ids.every(id => allowed.has(id));
};

const unionScopes = (
  a: PermissionStaffScope,
  b: PermissionStaffScope,
): PermissionStaffScope => {
  if (a.mode === "all") return a;
  if (b.mode === "all") return b;

  return {
    family: a.family,
    ids: [...new Set([...a.ids, ...b.ids])].sort(),
    mode: "selected",
  };
};

export const mergeStaffPermissionGrants = (
  grants: readonly PermissionsStaffArgs[],
): PermissionsStaffArgs[] => {
  const merged = new Map<string, PermissionsStaffArgs>();

  for (const grant of grants) {
    const key = staffPermissionKey(grant);
    const base = {
      module: grant.module,
      permission: grant.permission,
      plugin: grant.plugin,
    };
    const unscoped = merged.get(key);
    if (unscoped && !unscoped.scope) continue;

    if (!grant.scope) {
      for (const existing of merged.keys()) {
        if (existing.startsWith(`${key}|`)) merged.delete(existing);
      }
      merged.set(key, base);
      continue;
    }

    const familyKey = `${key}|${grant.scope.family}`;
    const existing = merged.get(familyKey);
    merged.set(familyKey, {
      ...base,
      scope: existing?.scope
        ? unionScopes(existing.scope, grant.scope)
        : grant.scope,
    });
  }

  return [...merged.values()];
};

const intersectScopes = (
  a: PermissionStaffScope,
  b: PermissionStaffScope | undefined,
): null | PermissionStaffScope => {
  if (!b) return a;
  if (a.family !== b.family) return b.mode === "all" ? a : null;
  if (b.mode === "all") return a;
  if (a.mode === "all") return b;

  const allowed = new Set(b.ids);
  const ids = a.ids.filter(id => allowed.has(id)).sort();

  return ids.length > 0 ? { family: a.family, ids, mode: "selected" } : null;
};

export const applyScopedStaffDependencies = (
  grants: readonly PermissionsStaffArgs[],
  catalog: readonly { moderator: PermissionStaffModules; pluginId: string }[],
): PermissionsStaffArgs[] => {
  const dependencies = new Map<string, string[]>();
  for (const plugin of catalog) {
    for (const [module, entries] of Object.entries(plugin.moderator)) {
      for (const entry of entries) {
        dependencies.set(
          staffPermissionKey({
            module,
            permission: entry.permission,
            plugin: plugin.pluginId,
          }),
          entry.dependsOn,
        );
      }
    }
  }

  let current = [...grants];
  let changed = true;
  while (changed) {
    changed = false;
    const next: PermissionsStaffArgs[] = [];
    for (const grant of current) {
      if (!grant.scope) {
        next.push(grant);
        continue;
      }

      let scope: null | PermissionStaffScope = grant.scope;
      for (const dependency of dependencies.get(staffPermissionKey(grant)) ??
        []) {
        if (!scope) break;
        const held = current.filter(
          other =>
            other.plugin === grant.plugin &&
            other.module === grant.module &&
            other.permission === dependency,
        );
        if (held.length === 0) {
          scope = null;
          break;
        }
        if (held.some(other => !other.scope)) continue;
        const narrowing: PermissionStaffScope = scope;
        let widest: null | PermissionStaffScope = null;
        for (const other of held) {
          const overlap = intersectScopes(narrowing, other.scope);
          if (!overlap) continue;
          widest = widest ? unionScopes(widest, overlap) : overlap;
        }
        scope = widest;
      }

      if (!scope) {
        changed = true;
        continue;
      }
      if (JSON.stringify(scope) !== JSON.stringify(grant.scope)) changed = true;
      next.push({ ...grant, scope });
    }
    current = next;
  }

  return current;
};

/**
 * Nobody's permissions - the answer when there is no admin session to read one
 * from.
 *
 * Shared rather than written out at each call site, because three of them
 * existed and each was one typo away from being `{ root: true }`. Frozen so a
 * reader cannot push into the array it holds and quietly grant a permission to
 * every other reader of the same value.
 *
 * It is a *fallback*, never a failure signal: a rejected session read must not
 * arrive here as "this admin has no permissions". See `AdminStaffPermission`'s
 * provider, which mounts this only when the session genuinely answered without
 * one.
 */
const NO_PERMISSIONS: PermissionsStaffArgs[] = [];
Object.freeze(NO_PERMISSIONS);

export const EMPTY_STAFF_PERMISSION_SET: StaffPermissionSet = Object.freeze({
  root: false,
  permissions: NO_PERMISSIONS,
});
