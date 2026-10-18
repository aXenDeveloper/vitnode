/** A role as the roles picker lists it. */
export interface RoleOption {
  /** The role's color, or `null` for none. */
  color: null | string;
  id: number;
  /** The role's name in each language it was given. */
  name: { languageCode: string; name: string }[];
}

export type RoleSearch = (search: string) => Promise<RoleOption[]>;

/** A role's name in `locale`, else its first name, else its id as text. */
export const roleOptionName = (role: RoleOption, locale: string): string =>
  role.name.find(item => item.languageCode === locale)?.name ??
  role.name[0]?.name ??
  String(role.id);
