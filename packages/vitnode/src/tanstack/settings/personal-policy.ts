import {
  fetchPersonalInfoPolicy,
  personalInfoPolicyQueryOptions,
} from "@/views/auth/settings/overview/personal-update";

export const personalInfoPolicyQuery = () =>
  personalInfoPolicyQueryOptions({ fetchPolicy: fetchPersonalInfoPolicy });
