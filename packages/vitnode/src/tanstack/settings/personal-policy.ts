import type { PersonalInfoPolicyFetcher } from "@/views/auth/settings/overview/personal-update";

import { fetcher } from "@/tanstack/fetcher";
import {
  personalInfoPolicyFetcher,
  personalInfoPolicyQueryOptions,
} from "@/views/auth/settings/overview/personal-update";

const fetchPolicy: PersonalInfoPolicyFetcher =
  personalInfoPolicyFetcher(fetcher);

export const personalInfoPolicyQuery = () =>
  personalInfoPolicyQueryOptions({ fetchPolicy });
