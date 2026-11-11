import type { PermissionStaffType } from "../api/lib/permission-staff";
import type { PluginManifest } from "./plugin-manifest";

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

declare const staffPermissionBrand: unique symbol;

/**
 * A reference to one declared staff permission. Only {@link defineStaffPermissions}
 * (or, for permissions generated at runtime, {@link declaredStaffPermission})
 * creates one: a hand-written `{ module, permission }` is not a reference, and an
 * admin reference is never a moderator one, even with the same strings.
 *
 * At runtime it is a frozen `{ staffType, plugin, module, permission }`.
 */
export interface StaffPermissionRef<
  Type extends PermissionStaffType = PermissionStaffType,
  Plugin extends string = string,
  Module extends string = string,
  Permission extends string = string,
> {
  /** The permission module, e.g. `posts`. */
  readonly module: Module;
  /** The permission within it, e.g. `can_edit`. */
  readonly permission: Permission;
  /** The plugin that declares the permission. */
  readonly plugin: Plugin;
  readonly [staffPermissionBrand]: Type;
  /** Whether administrators or moderators are granted it. */
  readonly staffType: Type;
}

/** What `adminStaffPermission`, AdminCP navigation and dashboard widgets accept. */
export type AdminStaffPermissionRef<
  Plugin extends string = string,
  Module extends string = string,
  Permission extends string = string,
> = StaffPermissionRef<"admin", Plugin, Module, Permission>;

/** What `moderatorStaffPermission` accepts. */
export type ModeratorStaffPermissionRef<
  Plugin extends string = string,
  Module extends string = string,
  Permission extends string = string,
> = StaffPermissionRef<"moderator", Plugin, Module, Permission>;

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

/** `{ notes: ["can_create"] }` → `{ notes: { canCreate: StaffPermissionRef<Type, Plugin, "notes", "can_create"> } }`. */
export type StaffPermissionRefs<
  Type extends PermissionStaffType,
  Plugin extends string,
  M extends StaffPermissionModules,
> = {
  readonly [Module in keyof M & string]: {
    readonly [
      Entry in M[Module][number] as StaffPermissionKey<EntryName<Entry>>
    ]: StaffPermissionRef<Type, Plugin, Module, EntryName<Entry>>;
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

const createRef = <
  Type extends PermissionStaffType,
  Plugin extends string,
  Module extends string,
  Permission extends string,
>(
  staffType: Type,
  plugin: Plugin,
  module: Module,
  permission: Permission,
) =>
  Object.freeze({
    module,
    permission,
    plugin,
    staffType,
  }) as StaffPermissionRef<Type, Plugin, Module, Permission>;

const assertUniqueKeys = (
  staffType: PermissionStaffType,
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

const refsOf = <
  Type extends PermissionStaffType,
  Plugin extends string,
  M extends StaffPermissionModules,
>(
  staffType: Type,
  plugin: Plugin,
  modules: M | undefined,
): StaffPermissionRefs<Type, Plugin, M> => {
  assertUniqueKeys(staffType, modules ?? {});

  return Object.freeze(
    Object.fromEntries(
      Object.entries(modules ?? {}).map(([module, entries]) => [
        module,
        Object.freeze(
          Object.fromEntries(
            entries.map(entry => {
              const permission = nameOf(entry);

              return [
                staffPermissionKey(permission),
                createRef(staffType, plugin, module, permission),
              ];
            }),
          ),
        ),
      ]),
    ),
  ) as StaffPermissionRefs<Type, Plugin, M>;
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

/** The declarations of {@link defineStaffPermissions}, as the permission catalog stores them. */
export interface StaffPermissionsConfig {
  admin: Record<
    string,
    (string | { dependsOn?: string[]; permission: string; scope?: string })[]
  >;
  moderator: Record<
    string,
    (string | { dependsOn?: string[]; permission: string; scope?: string })[]
  >;
}

export interface DefinedStaffPermissions<
  Plugin extends string = string,
  Admin extends StaffPermissionModules = StaffPermissionModules,
  Moderator extends StaffPermissionModules = StaffPermissionModules,
> {
  /** References to the admin permissions: `admin.notes.canCreate`. */
  readonly admin: StaffPermissionRefs<"admin", Plugin, Admin>;
  /** The same declarations as plain data, which `buildApiPlugin` registers. */
  readonly config: StaffPermissionsConfig;
  /** References to the moderator permissions: `moderator.notes.canDelete`. */
  readonly moderator: StaffPermissionRefs<"moderator", Plugin, Moderator>;
  /** The plugin that declares them, from its manifest. */
  readonly pluginId: Plugin;
}

/**
 * Declares a plugin's staff permissions once and returns typed references to
 * them. Routes (`adminStaffPermission`, `moderatorStaffPermission`), AdminCP
 * navigation and dashboard widgets accept only these references, so a typo, a
 * permission nobody declares or an admin permission used as a moderator one is
 * a compile error.
 *
 * Every reference carries the declaring plugin, so a route or nav item may
 * guard with another plugin's permission and it is checked against that
 * plugin, never the route's own.
 *
 * Pass the result to `buildApiPlugin({ permissionStaff })`; it is the source of
 * truth for what the AdminCP offers to grant.
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
 * import { manifest } from "@/manifest.gen";
 *
 * export const staffPermissions = defineStaffPermissions(manifest, {
 *   admin: {
 *     notes: ["can_view", { permission: "can_edit", dependsOn: ["can_view"] }],
 *   },
 * });
 *
 * // src/config.api.ts
 * buildApiPlugin({ manifest, modules, permissionStaff: staffPermissions });
 *
 * // a route
 * buildRoute({ adminStaffPermission: staffPermissions.admin.notes.canEdit, ... });
 * ```
 */
export const defineStaffPermissions = <
  const Plugin extends string,
  const Admin extends StaffPermissionModules = Record<never, never>,
  const Moderator extends StaffPermissionModules = Record<never, never>,
>(
  manifest: Pick<PluginManifest<Plugin>, "id">,
  {
    admin,
    moderator,
  }: {
    /** Permissions grantable to AdminCP administrators, by permission module. */
    admin?: Admin;
    /** Permissions grantable to moderators, by permission module. Entries may name a moderation `scope`. */
    moderator?: Moderator;
  },
): DefinedStaffPermissions<Plugin, Admin, Moderator> => ({
  admin: refsOf("admin", manifest.id, admin),
  config: {
    admin: toConfig(admin ?? {}),
    moderator: toConfig(moderator ?? {}),
  },
  moderator: refsOf("moderator", manifest.id, moderator),
  pluginId: manifest.id,
});

/**
 * A reference as plain `{ plugin, module, permission }` data - what permission
 * sets, stored grants and `hasStaffPermission` work with.
 */
export const staffPermissionArgs = ({
  module,
  permission,
  plugin,
}: StaffPermissionRef): {
  module: string;
  permission: string;
  plugin: string;
} => ({
  module,
  permission,
  plugin,
});

/**
 * A reference to a permission generated at runtime rather than written in
 * {@link defineStaffPermissions} - the Content Engine's `can_view`/`can_edit`/...
 * of a content type or container. Checks `permission` against the generated
 * catalog the plugin registers for that module.
 *
 * @throws {Error} When `entries` does not declare `permission`, so a route can
 * never guard with a permission nobody can be granted.
 */
export const declaredStaffPermission = <
  const Type extends PermissionStaffType,
  const Plugin extends string,
>({
  entries,
  module,
  permission,
  plugin,
  staffType,
}: {
  /** The generated declarations of `module`, as the plugin registers them. */
  entries: readonly StaffPermissionEntry[];
  module: string;
  permission: string;
  plugin: Plugin;
  staffType: Type;
}): StaffPermissionRef<Type, Plugin> => {
  if (!entries.some(entry => nameOf(entry) === permission)) {
    throw new Error(
      `The ${staffType} permission "${permission}" is not generated for the "${module}" module of "${plugin}" (it has ${entries.map(entry => `"${nameOf(entry)}"`).join(", ") || "none"}). Nobody could be granted it.`,
    );
  }

  return createRef(staffType, plugin, module, permission);
};
