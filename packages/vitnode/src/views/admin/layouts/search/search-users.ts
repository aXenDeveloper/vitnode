/** One user, as the palette renders them. */
export interface AdminSearchUser {
  avatarColor: string;
  email: string;
  id: number;
  name: string;
  nameCode: string;
}

export type AdminUserSearch = (query: string) => Promise<AdminSearchUser[]>;

export const ADMIN_SEARCH_USERS_QUERY_KEY = [
  "vitnode",
  "admin-search-users",
] as const;

/** One query's key: the prefix above, plus the trimmed search term. */
export const adminSearchUsersQueryKey = (query: string): unknown[] => [
  ...ADMIN_SEARCH_USERS_QUERY_KEY,
  query,
];
