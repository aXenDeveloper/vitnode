import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import type { PluginRouteTranslator } from "@/routing";
import type { UserProfile } from "@/views/profile/profile-query";

import {
  isProfileNotFound,
  normalizeProfileNameCode,
} from "@/views/profile/profile-query";
import { profileTimelineQueryOptions } from "@/views/profile/profile-timeline-query";

import { sessionQueryOptions } from "../auth/session-query";
import { userProfileQuery } from "./query";

export const PROFILE_NAMESPACES = [
  "core.global",
  "core.profile",
  "core.search",
] as const;

export interface ProfileLoaderContext {
  locale: string;
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
      // oxlint-disable-next-line typescript/only-throw-error
      throw notFound();
    }

    throw error;
  }
};

// Started, not awaited: the timeline streams in with the page (pending queries
// dehydrate) without holding up the loader. The key must be
// the one `ProfileTimeline` builds, so the viewer comes from the same session
// entry the screen reads - shared with the shell's in-flight read when cold.
const startProfileTimeline = async ({
  locale,
  queryClient,
  userId,
}: {
  locale: string;
  queryClient: QueryClient;
  userId: number;
}): Promise<void> => {
  const session =
    queryClient.getQueryData(sessionQueryOptions().queryKey) ??
    (await queryClient.query(sessionQueryOptions()));

  await queryClient.infiniteQuery({
    ...profileTimelineQueryOptions({
      locale,
      userId,
      viewerId: session.user?.id ?? null,
    }),
    staleTime: "static",
  });
};

export const loadProfileRoute = async ({
  locale,
  nameCode: raw,
  queryClient,
  t,
}: ProfileLoaderContext & {
  nameCode: string;
  t: PluginRouteTranslator;
}): Promise<ProfileRouteData> => {
  const nameCode = normalizeProfileNameCode(raw);
  if (nameCode === null) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  const user = await ensureProfile(queryClient, nameCode);
  void startProfileTimeline({ locale, queryClient, userId: user.id }).catch(
    () => undefined,
  );
  const values = { name: user.name, nameCode: user.nameCode };

  return {
    description: t("core.profile.metaDesc", values),
    nameCode: user.nameCode,
    title: t("core.profile.title", values),
  };
};
