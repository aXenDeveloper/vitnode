import { queryOptions } from "@tanstack/react-query";

import type {
  PersonalInformationFields,
  UserPersonalInformation,
} from "@/lib/user-personal-information";
import type { BrowseAnonymouslyPolicy } from "@/lib/user-presence";

import { fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";

export interface PersonalInfoPolicy {
  /** Whether the member's roles let them choose Browse anonymously. */
  browseAnonymously: BrowseAnonymouslyPolicy;
  canEdit: boolean;
  fields: PersonalInformationFields;
}

export type PersonalInfoPolicyFetcher = () => Promise<PersonalInfoPolicy>;

export const fetchPersonalInfoPolicy: PersonalInfoPolicyFetcher = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "users",
    path: "/me/policy",
  });

  if (!response.ok) {
    throw new Error(`The account policy route answered ${response.status}.`);
  }

  return await response.json();
};

export const personalInfoPolicyQueryKey = () =>
  ["vitnode", "users", "me", "policy"] as const;

export const personalInfoPolicyQueryOptions = ({
  fetchPolicy = fetchPersonalInfoPolicy,
}: { fetchPolicy?: PersonalInfoPolicyFetcher } = {}) =>
  queryOptions({
    queryFn: async () => await fetchPolicy(),
    queryKey: personalInfoPolicyQueryKey(),
    retry: false,
    staleTime: OPERATIONAL_STALE_TIME,
  });

export type UpdatePersonalInformationInput = Partial<UserPersonalInformation>;

export interface UpdatePersonalInformationResult {
  data?: true;
  error?: { status: number };
}

export type UpdatePersonalInformation = (
  input: UpdatePersonalInformationInput,
) => Promise<UpdatePersonalInformationResult>;

export const updatePersonalInformationInBrowser: UpdatePersonalInformation =
  async input => {
    try {
      const response = await fetcherClient({
        plugin: manifest.id,
        args: { body: input },
        method: "patch",
        module: "users",
        options: { credentials: "include" },
        path: "/me",
      });

      return response.ok
        ? { data: true }
        : { error: { status: response.status } };
    } catch {
      return { error: { status: 500 } };
    }
  };
