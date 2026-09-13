import { queryOptions } from "@tanstack/react-query";

import type { RoleNameEntry } from "@/components/role-name";
import type { UniversalFetcher } from "@/lib/fetcher-client";

import { usersModule } from "@/api/modules.client";
import { fetcherClient } from "@/lib/fetcher-client";
import { RECORD_STALE_TIME } from "@/lib/query-freshness";

export const MAX_NAME_CODE_LENGTH = 255;

const NAME_CODE_PATTERN = /^[^\s/?#%]+$/u;

export const normalizeProfileNameCode = (raw: unknown): null | string => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_NAME_CODE_LENGTH) return null;

  return NAME_CODE_PATTERN.test(value) ? value : null;
};

export interface ProfileRole {
  color: null | string;
  id: number;
  name: RoleNameEntry[];
  prefix: null | string;
}

export interface UserProfile {
  avatarColor: string;
  avatarUrl: null | string;
  coverUrl: null | string;
  createdAt: Date | string;
  headline: null | string;
  id: number;
  name: string;
  nameCode: string;
  role: ProfileRole;
  secondaryRoles: ProfileRole[];
}

export type UserProfileFetcher = (nameCode: string) => Promise<UserProfile>;

const PROFILE_REQUEST_ERROR = "ProfileRequestError";

export class ProfileRequestError extends Error {
  constructor(status: number, nameCode: string) {
    super(`The profile API answered ${status} for @${nameCode}.`);
    this.name = PROFILE_REQUEST_ERROR;
    this.status = status;
  }

  readonly status: number;
}

export const isProfileNotFound = (error: unknown): boolean =>
  error instanceof Error &&
  error.name === PROFILE_REQUEST_ERROR &&
  (error as ProfileRequestError).status === 404;

export const userProfileFetcher =
  (transport: UniversalFetcher): UserProfileFetcher =>
  async nameCode => {
    const response = await transport(usersModule, {
      args: { params: { nameCode: encodeURIComponent(nameCode) } },
      method: "get",
      module: "users",
      path: "/profile/{nameCode}",
    });

    if (!response.ok) {
      throw new ProfileRequestError(response.status, nameCode);
    }

    return await response.json();
  };

export const fetchUserProfileInBrowser: UserProfileFetcher =
  userProfileFetcher(fetcherClient);

export const PROFILE_QUERY_ROOT = ["vitnode", "profile"] as const;

export const userProfileQueryKey = (nameCode: string) =>
  [...PROFILE_QUERY_ROOT, nameCode] as const;

export const userProfileQueryOptions = ({
  fetchProfile = fetchUserProfileInBrowser,
  nameCode,
}: {
  fetchProfile?: UserProfileFetcher;
  nameCode: string;
}) =>
  queryOptions({
    queryFn: async () => await fetchProfile(nameCode),
    queryKey: userProfileQueryKey(nameCode),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });
