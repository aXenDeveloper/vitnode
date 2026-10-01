/** One translation of one role's name, as the list response carries it. */
export interface RoleNameWord {
  itemId: number;
  languageCode: string;
  value: string;
}

export interface RoleUsersCount {
  roleId: number;
  total: number;
}

/**
 * The three derived fields of a page of roles, indexed rather than scanned.
 *
 * A page of roles times every translation of every one of them is a scan per
 * row per language, and a second scan per row for the counts - and both lists
 * already arrive keyed by the role they belong to. The response is unchanged,
 * key order included: `name` entries stay in the order the query returned them,
 * and the page keeps its own role order.
 */
export const withRolesAdminListFields = <TRole extends { id: number }>({
  adminRoleIds,
  names,
  roles,
  userCounts,
}: {
  /** Nullable because the column is: a `null` simply matches no role. */
  adminRoleIds: ReadonlySet<null | number>;
  names: readonly RoleNameWord[];
  roles: readonly TRole[];
  userCounts: readonly RoleUsersCount[];
}) => {
  const namesByRoleId = new Map<
    number,
    { languageCode: string; name: string }[]
  >();
  for (const word of names) {
    const forRole = namesByRoleId.get(word.itemId) ?? [];
    forRole.push({ name: word.value, languageCode: word.languageCode });
    namesByRoleId.set(word.itemId, forRole);
  }

  const usersCountByRoleId = new Map<number, number>();
  for (const item of userCounts) {
    usersCountByRoleId.set(
      item.roleId,
      (usersCountByRoleId.get(item.roleId) ?? 0) + item.total,
    );
  }

  return roles.map(role => ({
    ...role,
    name: namesByRoleId.get(role.id) ?? [],
    usersCount: usersCountByRoleId.get(role.id) ?? 0,
    grantsAdmin: adminRoleIds.has(role.id),
  }));
};
