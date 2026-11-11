/** One declared permission: its key, or an object with dependencies (and, for moderators, a scope). */
export type StaffPermissionEntry =
  | string
  | {
      readonly dependsOn?: readonly string[];
      readonly permission: string;
      readonly scope?: string;
    };

/** Permissions grouped by permission module, as `permissionStaff.admin` takes them. */
export type StaffPermissionModules = Readonly<
  Record<string, readonly StaffPermissionEntry[]>
>;

/** A reference to one permission: what `adminStaffPermission` and AdminCP `permission` accept. */
export interface StaffPermissionRef<
  Module extends string = string,
  Permission extends string = string,
> {
  readonly module: Module;
  readonly permission: Permission;
}

type EntryName<E> = E extends string
  ? E
  : E extends { readonly permission: infer P extends string }
    ? P
    : never;

type DashesToUnderscores<S extends string> =
  S extends `${infer Head}-${infer Tail}`
    ? `${Head}_${DashesToUnderscores<Tail>}`
    : S;

type UnderscoresToCamel<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<UnderscoresToCamel<Tail>>}`
    : S;

/**
 * `can_create` → `canCreate`, `view-logs` → `viewLogs`. The same rule as
 * {@link staffPermissionKey}, so a typed reference always exists at runtime.
 */
export type StaffPermissionKey<S extends string> = UnderscoresToCamel<
  DashesToUnderscores<S>
>;

/** `{ notes: ["can_create"] }` → `{ notes: { canCreate: { module: "notes", permission: "can_create" } } }`. */
export type StaffPermissionRefs<M extends StaffPermissionModules> = {
  readonly [Module in keyof M & string]: {
    readonly [
      Entry in M[Module][number] as StaffPermissionKey<EntryName<Entry>>
    ]: StaffPermissionRef<Module, EntryName<Entry>>;
  };
};

/**
 * The property name a permission gets in {@link defineStaffPermissions}'
 * references: `-` and `_` separate words, and every word after the first is
 * capitalized (`can_create` → `canCreate`). Mirrors {@link StaffPermissionKey}.
 */
export const staffPermissionKey = (permission: string): string => {
  const [head = "", ...tail] = permission.replaceAll("-", "_").split("_");

  return [
    head,
    ...tail.map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`),
  ].join("");
};

const nameOf = (entry: StaffPermissionEntry): string =>
  typeof entry === "string" ? entry : entry.permission;

const assertUniqueKeys = (
  staffType: "admin" | "moderator",
  modules: StaffPermissionModules,
) => {
  for (const [module, entries] of Object.entries(modules)) {
    const seen = new Map<string, string>();

    for (const entry of entries) {
      const permission = nameOf(entry);
      const key = staffPermissionKey(permission);
      const previous = seen.get(key);

      if (previous !== undefined && previous !== permission) {
        throw new Error(
          `defineStaffPermissions: ${staffType} permissions in module "${module}" collide on reference key "${key}": "${previous}" and "${permission}" both become ${staffType}.${module}.${key}. Rename or remove one of them.`,
        );
      }

      seen.set(key, permission);
    }
  }
};

const refsOf = (
  staffType: "admin" | "moderator",
  modules: StaffPermissionModules,
) => {
  assertUniqueKeys(staffType, modules);

  return Object.fromEntries(
    Object.entries(modules).map(([module, entries]) => [
      module,
      Object.fromEntries(
        entries.map(entry => {
          const permission = nameOf(entry);

          return [
            staffPermissionKey(permission),
            Object.freeze({ module, permission }),
          ];
        }),
      ),
    ]),
  );
};

const toConfig = (modules: StaffPermissionModules) =>
  Object.fromEntries(
    Object.entries(modules).map(([module, entries]) => [
      module,
      entries.map(entry =>
        typeof entry === "string"
          ? entry
          : {
              permission: entry.permission,
              ...(entry.dependsOn ? { dependsOn: [...entry.dependsOn] } : {}),
              ...(entry.scope ? { scope: entry.scope } : {}),
            },
      ),
    ]),
  );

/** What {@link defineStaffPermissions} returns. */
export interface DefinedStaffPermissions<
  Admin extends StaffPermissionModules,
  Moderator extends StaffPermissionModules,
> {
  /** References to the admin permissions: `admin.notes.canCreate`. */
  readonly admin: StaffPermissionRefs<Admin>;
  /** The same declarations, for `buildApiPlugin({ permissionStaff: permissions.config })`. */
  readonly config: {
    admin: Record<
      string,
      (string | { dependsOn?: string[]; permission: string; scope?: string })[]
    >;
    moderator: Record<
      string,
      (string | { dependsOn?: string[]; permission: string; scope?: string })[]
    >;
  };
  /** References to the moderator permissions: `moderator.notes.canDelete`. */
  readonly moderator: StaffPermissionRefs<Moderator>;
}

/**
 * Declares a plugin's staff permissions once and returns typed references to
 * them, so routes and AdminCP navigation name a permission that exists instead
 * of repeating `{ module: "notes", permission: "can_create" }` strings.
 *
 * Pass `config` to `buildApiPlugin({ permissionStaff })`; it is the source of
 * truth, exactly as if the object were written there.
 *
 * Universal and browser-safe. Keep the definition in its own module (e.g.
 * `src/staff-permissions.ts`) rather than in `config.api.ts`, so the AdminCP
 * navigation can import it without pulling in server code.
 *
 * @throws {Error} When two different permission names of the same module and
 * staff type normalize to the same reference key (`can_edit` and `can-edit`
 * both become `canEdit`). Repeating the exact same name, or the same key in
 * `admin` and `moderator` or in different modules, is fine.
 *
 * @example
 * ```ts
 * // src/staff-permissions.ts
 * import { defineStaffPermissions } from "@vitnode/core/lib/staff-permissions";
 *
 * export const staffPermissions = defineStaffPermissions({
 *   admin: {
 *     notes: ["can_view", { permission: "can_edit", dependsOn: ["can_view"] }],
 *   },
 * });
 *
 * // src/config.api.ts
 * buildApiPlugin({ manifest, modules, permissionStaff: staffPermissions.config });
 *
 * // a route
 * buildRoute({ adminStaffPermission: staffPermissions.admin.notes.canEdit, ... });
 * ```
 */
export const defineStaffPermissions = <
  const Admin extends StaffPermissionModules = Record<never, never>,
  const Moderator extends StaffPermissionModules = Record<never, never>,
>({
  admin,
  moderator,
}: {
  /** Permissions grantable to AdminCP administrators, by permission module. */
  admin?: Admin;
  /** Permissions grantable to moderators, by permission module. */
  moderator?: Moderator;
}): DefinedStaffPermissions<Admin, Moderator> => ({
  admin: refsOf("admin", admin ?? {}) as StaffPermissionRefs<Admin>,
  config: {
    admin: toConfig(admin ?? {}),
    moderator: toConfig(moderator ?? {}),
  },
  moderator: refsOf(
    "moderator",
    moderator ?? {},
  ) as StaffPermissionRefs<Moderator>,
});
