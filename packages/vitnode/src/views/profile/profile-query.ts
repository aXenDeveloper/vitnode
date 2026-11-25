import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import type { RoleNameEntry } from "@/components/role-name";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

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

/** One content type a profile lists, as the profile API names it. */
export interface ProfileContentType {
  /** Stable content type id, e.g. `forum.comment`. */
  id: string;
  /** Full i18n key of the type's filter label, an ICU plural called with `count`. */
  label: string;
}

/** What a member authored, as a guest sees it. */
export interface ProfileContentStats {
  /** One count per listed content type, zeros included. */
  byType: Record<string, number>;
  /** The sum of `byType`. */
  total: number;
  /** Every content type the app lists on profiles, sorted by id. */
  types: ProfileContentType[];
}

export interface UserProfile {
  avatarColor: string;
  avatarUrl: null | string;
  /**
   * What the member authored, by content type. Absent from older APIs - an
   * unknown count, which is not the same as zero.
   */
  contentStats?: ProfileContentStats;
  coverUrl: null | string;
  createdAt: Date | string;
  headline: null | string;
  id: number;
  name: string;
  nameCode: string;
  /** The profile's social card, or `null` when the API draws none. */
  ogImage?: null | {
    alt: string;
    height: number;
    type: string;
    url: string;
    width: number;
  };
  /** Points from reactions to the member's content; can be negative. Absent from older APIs. */
  reputation?: number;
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

export const fetchUserProfile: UserProfileFetcher = async nameCode => {
  const response = await fetcher({
    plugin: manifest.id,
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

export const PROFILE_QUERY_ROOT = ["vitnode", "profile"] as const;

export const userProfileQueryKey = (nameCode: string) =>
  [...PROFILE_QUERY_ROOT, nameCode] as const;

export const userProfileQueryOptions = ({
  fetchProfile = fetchUserProfile,
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
