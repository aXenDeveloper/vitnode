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
