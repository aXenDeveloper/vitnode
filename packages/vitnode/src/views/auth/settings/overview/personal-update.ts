import { queryOptions } from "@tanstack/react-query";

import type { usersModule } from "@/api/modules/users/users.module";
import type { UniversalFetcher } from "@/lib/fetcher-client";
import type {
  PersonalInformationFields,
  UserPersonalInformation,
} from "@/lib/user-personal-information";

import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";

const usersModuleRef = clientModule<typeof usersModule>(CONFIG_PLUGIN.pluginId);

export interface PersonalInfoPolicy {
  canEdit: boolean;
  fields: PersonalInformationFields;
}

export type PersonalInfoPolicyFetcher = () => Promise<PersonalInfoPolicy>;

export const personalInfoPolicyFetcher =
  (transport: UniversalFetcher): PersonalInfoPolicyFetcher =>
  async () => {
    const response = await transport(usersModuleRef, {
      method: "get",
      module: "users",
      path: "/me/policy",
    });

    if (!response.ok) {
      throw new Error(`The account policy route answered ${response.status}.`);
    }

    return await response.json();
  };

export const fetchPersonalInfoPolicyInBrowser: PersonalInfoPolicyFetcher =
  personalInfoPolicyFetcher(fetcherClient);

export const personalInfoPolicyQueryKey = () =>
  ["vitnode", "users", "me", "policy"] as const;

export const personalInfoPolicyQueryOptions = ({
  fetchPolicy = fetchPersonalInfoPolicyInBrowser,
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
      const response = await fetcherClient(usersModuleRef, {
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
