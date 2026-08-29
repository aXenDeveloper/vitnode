/**
 * The staff permission model, with nothing in it that needs a browser.
 *
 * Two staff groups - administrators and moderators - each a table of entries
 * that grant a *role* or a *user* a set of permissions. What the AdminCP's
 * create and edit screens do to that model is entirely arithmetic:
 *
 *     catalog + granted  ->  the checkbox tree the form renders
 *     a toggle           ->  the next checked set, dependencies honoured
 *     the checked set    ->  the permission list the API is sent
 *
 * All three are here, pure, because all three have to behave identically in the
 * Next.js AdminCP and the TanStack one, and because getting any of them wrong
 * grants or revokes access silently. `staff-model.test.ts` is the specification.
 *
 * ## The dependency rule, stated once
 *
 * A catalog entry may declare `dependsOn: ["can_view"]` - "this permission is
 * meaningless without that one". The API enforces it on write
 * (`update-permissions.route.ts` drops any grant whose dependencies are missing,
 * repeatedly, until the set is stable) and the form has to agree, or an
 * administrator ticks a box, saves, and finds it un-ticked with no explanation.
 *
 * Two halves, and both are needed:
 *
 * - **Turning one off turns off everything that depended on it**, transitively.
 *   Otherwise the form would submit a set the API is about to prune.
 * - **A permission whose dependencies are not all granted is locked**, not
 *   merely unchecked, so the reason is visible before the save rather than after.
 */

import type {
  PermissionsStaffArgs,
  PermissionStaffType,
} from "@/api/lib/permission-staff";

import { staffPermissionKey } from "@/api/lib/staff-permission";

/* -------------------------------------------------------------------------- */
/*                              Where things live                             */
/* -------------------------------------------------------------------------- */

/**
 * The URL segment each staff type lives under.
 *
 * `admin`/`moderator` is the API's vocabulary (the `{type}` path parameter and
 * the permission-catalog key); `admins`/`moderators` is the URL's. They differ
 * by a letter, which is exactly why the mapping is written down instead of
 * spelled out at each of the eight places that needed it.
 */
export const STAFF_TYPE_SEGMENT = {
  admin: "admins",
  moderator: "moderators",
} as const satisfies Record<PermissionStaffType, string>;

export type StaffTypeSegment = (typeof STAFF_TYPE_SEGMENT)[PermissionStaffType];

/** The reverse, for a route that knows only which folder it is in. */
export const staffTypeFromSegment = (
  segment: string,
): null | PermissionStaffType => {
  if (segment === STAFF_TYPE_SEGMENT.admin) return "admin";
  if (segment === STAFF_TYPE_SEGMENT.moderator) return "moderator";

  return null;
};

/** `/admin/core/staff/admins` - the list a save or a cancel returns to. */
export const staffListHref = (type: PermissionStaffType): string =>
  `/admin/core/staff/${STAFF_TYPE_SEGMENT[type]}`;

/** `/admin/core/staff/admins/create`. */
export const staffCreateHref = (type: PermissionStaffType): string =>
  `${staffListHref(type)}/create`;

/**
 * `/admin/core/staff/admins/edit/12` - where a create goes when it succeeds.
 *
 * Creating an entry grants *nothing*: the row exists with no permissions until
 * somebody chooses them. Landing on the edit screen rather than back on the list
 * is what makes that a two-step flow instead of a silent no-op.
 */
export const staffEditHref = (
  type: PermissionStaffType,
  id: number | string,
): string => `${staffListHref(type)}/edit/${id}`;

/**
 * The breadcrumb labels these screens override.
 *
 * `/admin/core/staff` is a nav *group* with no page of its own, and
 * `/admin/core/staff/admins` is in the sidebar under a shorter name than the
 * page's own heading - so both are named explicitly rather than humanised from
 * the URL. Returned as data so the Next.js `@breadcrumb` slot and the TanStack
 * `staticData.breadcrumb` build the same trail from the same two strings.
 */
export const staffBreadcrumbLabels = ({
  listLabel,
  type,
  staffLabel,
}: {
  listLabel: string;
  staffLabel: string;
  type: PermissionStaffType;
}): Record<string, string> => ({
  "/admin/core/staff": staffLabel,
  [staffListHref(type)]: listLabel,
});

/* -------------------------------------------------------------------------- */
/*                                 Entry ids                                  */
/* -------------------------------------------------------------------------- */

/** Postgres `integer`, the same ceiling the users route has. */
const MAX_STAFF_ENTRY_ID = 2_147_483_647;

/**
 * The staff entry id in the URL, or `null` if it cannot be one.
 *
 * The same rule as {@link normalizeAdminUserId}, and for the same reason: `$id`
 * matches any segment, `Number("abc")` is `NaN`, and `?id=NaN` is a request
 * nobody meant to make. One decimal spelling per id keeps the cache honest.
 */
export const normalizeStaffEntryId = (
  raw: null | string | string[] | undefined,
): null | string => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  if (!/^[1-9]\d*$/.test(value)) return null;

  return Number(value) <= MAX_STAFF_ENTRY_ID ? value : null;
};

/* -------------------------------------------------------------------------- */
/*                            The permission catalog                          */
/* -------------------------------------------------------------------------- */

/** One permission as a plugin declares it, after normalisation on the API. */
export interface StaffCatalogEntry {
  dependsOn: string[];
  permission: string;
}

/** `GET /admin/staff/permission-catalog`, as it comes back. */
export interface StaffCatalogPlugin {
  admin: Record<string, StaffCatalogEntry[]>;
  moderator: Record<string, StaffCatalogEntry[]>;
  pluginId: string;
}

export type StaffCatalog = StaffCatalogPlugin[];

/** One row of the form: a permission, and whether it can be ticked. */
export interface StaffPermissionItem extends PermissionsStaffArgs {
  /** Every dependency, as full `plugin:module:permission` keys. */
  dependsOn: string[];
  key: string;
  label: string;
}

export interface StaffModuleGroup {
  label: string;
  module: string;
  permissions: StaffPermissionItem[];
}

export interface StaffPluginGroup {
  label: string;
  modules: StaffModuleGroup[];
  pluginId: string;
}

/**
 * How a label is looked up, without naming an i18n library.
 *
 * The AdminCP's permission labels are *flat top-level message keys* -
 * `"@vitnode/core:users:can_view"` - because a plugin declares them in its own
 * locale file and they have to merge into one tree. So the lookup is
 * "translate this exact key, or tell me you cannot", which is what both
 * `next-intl`'s root translator and a plain resolved map can answer.
 */
export type StaffLabelLookup = (key: string) => string | undefined;

/**
 * The whole checkbox tree, built from what the API declared and what is granted.
 *
 * Plugins with no permissions *for this staff type* are dropped, and so are
 * modules with none: `moderator` and `admin` are separate catalogs, and a plugin
 * that declares only admin permissions must not appear as an empty section on
 * the moderators screen.
 *
 * The label falls back to the raw identifier rather than to an empty string. A
 * plugin that shipped no translation still has a usable form - `can_delete` is
 * ugly but true - where a blank row is a permission nobody can identify.
 */
export const buildStaffPermissionGroups = ({
  catalog,
  label,
  type,
}: {
  catalog: StaffCatalog;
  label: StaffLabelLookup;
  type: PermissionStaffType;
}): StaffPluginGroup[] =>
  catalog
    .map(plugin => {
      const modules = Object.entries(plugin[type])
        .map(([module, permissions]) => ({
          label: label(`${plugin.pluginId}:${module}`) ?? module,
          module,
          permissions: permissions.map(entry => {
            const args = {
              module,
              permission: entry.permission,
              plugin: plugin.pluginId,
            };
            const key = staffPermissionKey(args);

            return {
              ...args,
              dependsOn: entry.dependsOn.map(dependency =>
                staffPermissionKey({
                  module,
                  permission: dependency,
                  plugin: plugin.pluginId,
                }),
              ),
              key,
              label: label(key) ?? entry.permission,
            };
          }),
        }))
        .filter(module => module.permissions.length > 0);

      return {
        label: label(`${plugin.pluginId}.title`) ?? plugin.pluginId,
        modules,
        pluginId: plugin.pluginId,
      };
    })
    .filter(plugin => plugin.modules.length > 0);

/** Every permission in the tree, flattened - the form's working set. */
export const staffPermissionItems = (
  plugins: StaffPluginGroup[],
): StaffPermissionItem[] =>
  plugins.flatMap(plugin =>
    plugin.modules.flatMap(module => module.permissions),
  );

/** The keys granted on an entry, as the set the form starts from. */
export const grantedStaffPermissionKeys = (
  permissions: readonly PermissionsStaffArgs[],
): Set<string> =>
  new Set(permissions.map(permission => staffPermissionKey(permission)));

/* -------------------------------------------------------------------------- */
/*                              Dependency rules                              */
/* -------------------------------------------------------------------------- */

/** Which permissions would break if a given key were revoked. */
export const staffPermissionDependents = (
  items: readonly StaffPermissionItem[],
): Map<string, string[]> => {
  const dependents = new Map<string, string[]>();
  for (const item of items) {
    for (const dependency of item.dependsOn) {
      dependents.set(dependency, [
        ...(dependents.get(dependency) ?? []),
        item.key,
      ]);
    }
  }

  return dependents;
};

/**
 * Whether a permission may be ticked at all right now.
 *
 * Locked, not hidden: the row stays visible with the dependency named, so an
 * administrator can see *why* it is unavailable and what to grant first.
 */
export const isStaffPermissionLocked = (
  item: Pick<StaffPermissionItem, "dependsOn">,
  checked: ReadonlySet<string>,
): boolean => !item.dependsOn.every(dependency => checked.has(dependency));

/**
 * The next checked set after one toggle.
 *
 * Turning a permission *on* is a single addition - the form only offers the box
 * when its dependencies are already granted, so nothing else has to change.
 *
 * Turning one *off* cascades: everything that depended on it, and everything
 * that depended on those, down to a fixed point. The walk is a stack rather than
 * recursion and only pushes keys still in the set, so a dependency cycle - which
 * a badly declared plugin can produce - terminates instead of hanging the tab.
 *
 * Returns a new `Set` and never mutates the one it was given, so it is safe as a
 * `setState` updater.
 */
export const toggleStaffPermission = ({
  checked,
  dependents,
  key,
  value,
}: {
  checked: ReadonlySet<string>;
  dependents: ReadonlyMap<string, string[]>;
  key: string;
  value: boolean;
}): Set<string> => {
  const next = new Set(checked);
  if (value) {
    next.add(key);

    return next;
  }

  const stack = [key];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    next.delete(current);
    for (const dependent of dependents.get(current) ?? []) {
      if (next.has(dependent)) stack.push(dependent);
    }
  }

  return next;
};

/**
 * Tick or clear a whole module or a whole plugin at once.
 *
 * Deliberately *not* dependency-aware in the "on" direction: selecting
 * everything in a module grants the dependencies too, because they are in the
 * module. In the "off" direction it is a plain removal, and the submit
 * transformation below is what stops a half-cleared module from sending a grant
 * whose gate has gone.
 */
export const setStaffPermissionsChecked = ({
  checked,
  keys,
  value,
}: {
  checked: ReadonlySet<string>;
  keys: readonly string[];
  value: boolean;
}): Set<string> => {
  const next = new Set(checked);
  for (const key of keys) {
    if (value) {
      next.add(key);
    } else {
      next.delete(key);
    }
  }

  return next;
};

/** How many of a module's permissions are granted - the `3/7` badge. */
export const countGrantedStaffPermissions = (
  permissions: readonly StaffPermissionItem[],
  checked: ReadonlySet<string>,
): number =>
  permissions.reduce(
    (total, item) => total + (checked.has(item.key) ? 1 : 0),
    0,
  );

/* -------------------------------------------------------------------------- */
/*                               What is submitted                            */
/* -------------------------------------------------------------------------- */

/**
 * The permission list the API is sent.
 *
 * Three rules, and each one mirrors something `update-permissions.route.ts` does
 * on the way in - so the form submits what it is about to be given back rather
 * than something the API will quietly prune:
 *
 * 1. **Unrestricted sends nothing.** The flag means "everything, including
 *    permissions that do not exist yet", so an explicit list alongside it is at
 *    best redundant and at worst a snapshot that looks authoritative later.
 * 2. **Only permissions in the catalog.** The set is built from the catalog, so
 *    this holds by construction - but it is what makes the empty case correct
 *    when a plugin is uninstalled between load and save.
 * 3. **Only permissions whose dependencies are all granted.** The cascade above
 *    keeps the set clean while editing; this is the final gate, and it is
 *    applied repeatedly until stable so a broken chain collapses completely
 *    rather than one link at a time.
 */
export const staffPermissionsForSubmit = ({
  checked,
  items,
  unrestricted,
}: {
  checked: ReadonlySet<string>;
  items: readonly StaffPermissionItem[];
  unrestricted: boolean;
}): PermissionsStaffArgs[] => {
  if (unrestricted) return [];

  const byKey = new Map(items.map(item => [item.key, item]));
  const granted = new Set([...checked].filter(key => byKey.has(key)));

  let changed = true;
  while (changed) {
    changed = false;
    for (const key of granted) {
      const item = byKey.get(key);
      if (!item) continue;
      if (item.dependsOn.some(dependency => !granted.has(dependency))) {
        granted.delete(key);
        changed = true;
      }
    }
  }

  // Ordered by the catalog rather than by the set's insertion order, so two
  // administrators saving the same choices produce the same request body.
  return items
    .filter(item => granted.has(item.key))
    .map(({ module, permission, plugin }) => ({ module, permission, plugin }));
};

/* -------------------------------------------------------------------------- */
/*                          Labels, and how to load them                      */
/* -------------------------------------------------------------------------- */

/**
 * Every message key the permission tree needs, in a stable order.
 *
 * One per plugin title, one per module and one per permission - so a catalog
 * with ten modules and thirty permissions needs forty-one keys, and they are all
 * *top-level* keys in the merged message tree rather than a namespace anything
 * can be sliced by.
 *
 * That matters because the i18n runtime takes namespaces, not keys, and refuses
 * more than {@link MAX_NAMESPACES} of them per request. So the loader asks for
 * these in chunks - see {@link chunkStaffLabelKeys} - which is why they have to
 * be enumerable, de-duplicated and deterministic rather than read ad hoc while
 * rendering.
 */
export const staffLabelKeys = ({
  catalog,
  type,
}: {
  catalog: StaffCatalog;
  type: PermissionStaffType;
}): string[] => {
  const keys = new Set<string>();
  for (const plugin of catalog) {
    const modules = Object.entries(plugin[type]).filter(
      ([, permissions]) => permissions.length > 0,
    );
    if (modules.length === 0) continue;
    keys.add(plugin.pluginId);
    for (const [module, permissions] of modules) {
      keys.add(`${plugin.pluginId}:${module}`);
      for (const entry of permissions) {
        keys.add(
          staffPermissionKey({
            module,
            permission: entry.permission,
            plugin: plugin.pluginId,
          }),
        );
      }
    }
  }

  return [...keys];
};

/**
 * Those keys, split into requests the i18n runtime will accept.
 *
 * A plain fixed-size chunking, and the size is the caller's because the limit
 * belongs to the i18n layer rather than to the staff model. An empty catalog
 * chunks to nothing rather than to one empty request.
 */
export const chunkStaffLabelKeys = (
  keys: readonly string[],
  size: number,
): string[][] => {
  if (size < 1) throw new Error("chunkStaffLabelKeys needs a positive size.");
  const chunks: string[][] = [];
  for (let index = 0; index < keys.length; index += size) {
    chunks.push([...keys.slice(index, index + size)]);
  }

  return chunks;
};

/**
 * A label lookup over messages that were loaded as flat keys.
 *
 * `"@vitnode/core"` is an object (`{ title }`) because a plugin's own namespace
 * holds more than its name, while `"@vitnode/core:users"` is a plain string - so
 * the two shapes are both handled here rather than at every call site. Anything
 * else present under a key is ignored rather than stringified, because
 * `[object Object]` in a permission list is worse than the raw identifier.
 */
export const staffLabelLookupFrom = (
  messages: Record<string, unknown>,
): StaffLabelLookup => {
  const titleOf = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (typeof value !== "object" || value === null) return undefined;
    const title = (value as { title?: unknown }).title;

    return typeof title === "string" ? title : undefined;
  };

  return key => {
    // `"@vitnode/blog.title"` is how the plugin heading is asked for; the
    // messages hold it as `{ "@vitnode/blog": { title } }`.
    if (key.endsWith(".title")) {
      return titleOf(messages[key.slice(0, -".title".length)]);
    }

    return titleOf(messages[key]);
  };
};
