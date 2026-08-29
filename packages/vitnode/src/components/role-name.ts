/**
 * A role's name, in the language the reader is using.
 *
 * Role names live in `core_languages_words`, so every API that returns a role
 * returns *all* of its translations - the server has no business deciding which
 * language the person looking at the screen reads in. This is the one place that
 * decision is made, so the users table, the roles table, both staff screens and
 * every picker resolve it the same way.
 *
 * Falls back to the first translation and then to the id, in that order: a role
 * with no English name is still a role somebody named, and an empty span is a
 * row nobody can identify. Pure and import-free.
 */

export interface RoleNameEntry {
  languageCode: string;
  name: string;
}

export interface RoleNameRef {
  id?: number;
  name: RoleNameEntry[];
}

export const resolveRoleName = (role: RoleNameRef, locale: string): string =>
  role.name.find(item => item.languageCode === locale)?.name ??
  role.name[0]?.name ??
  (role.id === undefined ? "" : String(role.id));
