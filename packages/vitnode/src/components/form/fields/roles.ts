/**
 * What a role picker is, as data - and nothing about where the roles came from.
 *
 * Zero imports, deliberately. This module is the reason `AutoFormRoles` can be
 * rendered by any VitNode host: the shape a picker needs and the shape of the
 * function that supplies it are both stated here, so the component depends on a
 * type rather than on a transport.
 *
 * It exists because the type used to live in `search-roles.action.server.ts`,
 * which is a `"use server"` module carrying `server-only`. Importing a module to
 * read a type is free at runtime *only* if every importer remembers to write
 * `import type` - and the same file also exported the default search, so the one
 * static import that was not type-only put Next's request scope in the module
 * graph of every application rendering a role field. A type belongs somewhere
 * nothing has to be careful about.
 */

/**
 * One role, as a picker or a filter needs it.
 *
 * `name` stays the raw per-language list: the server has no business deciding
 * which language the person clicking reads in, so it is resolved against the
 * active locale where it is rendered - see {@link roleOptionName}.
 *
 * Structurally identical to `AdminRoleOption`
 * (`views/admin/views/core/users/roles/roles-query`), which is what lets the
 * AdminCP's own browser search be handed straight to this field.
 */
export interface RoleOption {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

/**
 * How a role field finds roles.
 *
 * Injected rather than defaulted, and that is the whole contract: the field
 * renders roles, and *reading* them is the host's business. A VitNode app on
 * TanStack Start hands it a browser fetch to Hono; a Next.js app hands it a
 * server action. Neither is named here, so neither is imported here.
 */
export type RoleSearch = (search: string) => Promise<RoleOption[]>;

/**
 * A role's name in the reader's language.
 *
 * Falls back to the first translation rather than to the id: a role with no
 * English name is still a role somebody named, and showing `4` helps nobody.
 *
 * Re-exported from `./input-roles`, which is the path the documentation gives
 * for it, so moving it here changes nothing for a caller.
 */
export const roleOptionName = (role: RoleOption, locale: string): string =>
  role.name.find(item => item.languageCode === locale)?.name ??
  role.name[0]?.name ??
  String(role.id);
