export interface RoleOption {
  color: null | string;
  id: number;
  name: { languageCode: string; name: string }[];
}

export type RoleSearch = (search: string) => Promise<RoleOption[]>;

export const roleOptionName = (role: RoleOption, locale: string): string =>
  role.name.find(item => item.languageCode === locale)?.name ??
  role.name[0]?.name ??
  String(role.id);
