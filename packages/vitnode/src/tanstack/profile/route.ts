import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import type { PluginRouteTranslator } from "@/routing";
import type { UserProfile } from "@/views/profile/profile-query";

import {
  isProfileNotFound,
  normalizeProfileNameCode,
} from "@/views/profile/profile-query";

import { userProfileQuery } from "./query";

export const PROFILE_NAMESPACES = ["core.global", "core.profile"] as const;

export interface ProfileLoaderContext {
  queryClient: QueryClient;
}

export interface ProfileRouteData {
  description: string;
  nameCode: string;
  title: string;
}

const ensureProfile = async (
  queryClient: QueryClient,
  nameCode: string,
): Promise<UserProfile> => {
  try {
    return await queryClient.query({
      ...userProfileQuery(nameCode),
      staleTime: "static",
    });
  } catch (error) {
    if (isProfileNotFound(error)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw notFound();
    }

    throw error;
  }
};

export const loadProfileRoute = async ({
  nameCode: raw,
  queryClient,
  t,
}: ProfileLoaderContext & {
  nameCode: string;
  t: PluginRouteTranslator;
}): Promise<ProfileRouteData> => {
  const nameCode = normalizeProfileNameCode(raw);
  if (nameCode === null) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  const user = await ensureProfile(queryClient, nameCode);
  const values = { name: user.name, nameCode: user.nameCode };

  return {
    description: t("core.profile.metaDesc", values),
    nameCode: user.nameCode,
    title: t("core.profile.title", values),
  };
};
