import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";

import type { PluginRouteOpenGraph, PluginRouteTranslator } from "@/routing";
import type {
  ProfileContentStats,
  UserProfile,
} from "@/views/profile/profile-query";

import { profileContentQueryOptions } from "@/views/profile/profile-content-query";
import {
  isProfileNotFound,
  normalizeProfileNameCode,
} from "@/views/profile/profile-query";
import { profileTimelineQueryOptions } from "@/views/profile/profile-timeline-query";

import type { ProfileRouteSearch } from "./route-search";

import { sessionQueryOptions } from "../auth/session-query";
import { intlQueryOptions } from "../i18n/query";
import { userProfileQuery } from "./query";

export const PROFILE_NAMESPACES = [
  "core.global",
  "core.profile",
  "core.reactions",
  "core.search",
] as const;

/** The namespace a full label key lives in: everything before its last dot. */
const labelNamespace = (key: string): string =>
  key.slice(0, key.lastIndexOf("."));

/**
 * The message namespaces the Content tab reads: the profile's own plus the
 * one holding each listed type's label (`@vitnode/forum.content.topic`).
 */
export const profileContentNamespaces = (
  stats: Pick<ProfileContentStats, "types">,
): string[] => [
  ...PROFILE_NAMESPACES,
  ...new Set(stats.types.map(entry => labelNamespace(entry.label))),
];

/**
 * The Content tab's filter: `type` when the profile still lists it, else
 * `null` (All) - so a bookmarked filter for a type this install no longer
 * lists falls back to All instead of failing.
 */
export const profileContentFilter = (
  user: Pick<UserProfile, "contentStats">,
  type: string | undefined,
): null | string =>
  type !== undefined &&
  (user.contentStats?.types.some(entry => entry.id === type) ?? false)
    ? type
    : null;

export interface ProfileLoaderContext {
  locale: string;
  queryClient: QueryClient;
}

export interface ProfileRouteData {
  description: string;
  nameCode: string;
  /** `og:type` `profile`, with the member's card when the API draws one. */
  openGraph: PluginRouteOpenGraph;
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

// Started, not awaited, like the Activity tab: the guest-scoped list does not
// depend on who is looking, so there is no session to wait for. The type
// labels' messages are warmed alongside, so the filters render at once.
const startProfileContent = async ({
  locale,
  queryClient,
  stats,
  type,
  userId,
}: {
  locale: string;
  queryClient: QueryClient;
  stats: ProfileContentStats;
  type: null | string;
  userId: number;
}): Promise<void> => {
  await Promise.all([
    queryClient.query(
      intlQueryOptions({ locale, namespaces: profileContentNamespaces(stats) }),
    ),
    queryClient.infiniteQuery({
      ...profileContentQueryOptions({ locale, type, userId }),
      staleTime: "static",
    }),
  ]);
};

export const loadProfileRoute = async ({
  locale,
  nameCode: raw,
  queryClient,
  search = {},
  t,
}: ProfileLoaderContext & {
  nameCode: string;
  search?: ProfileRouteSearch;
  t: PluginRouteTranslator;
}): Promise<ProfileRouteData> => {
  const nameCode = normalizeProfileNameCode(raw);
  if (nameCode === null) {
    // oxlint-disable-next-line typescript/only-throw-error
    throw notFound();
  }

  const user = await ensureProfile(queryClient, nameCode);
  const started =
    search.tab === "content" && user.contentStats
      ? startProfileContent({
          locale,
          queryClient,
          stats: user.contentStats,
          type: profileContentFilter(user, search.type),
          userId: user.id,
        })
      : startProfileTimeline({ locale, queryClient, userId: user.id });
  void started.catch(() => undefined);
  const values = { name: user.name, nameCode: user.nameCode };

  return {
    description: t("core.profile.metaDesc", values),
    nameCode: user.nameCode,
    openGraph: {
      title: user.name,
      type: "profile",
      ...(user.ogImage ? { image: user.ogImage } : {}),
    },
    title: t("core.profile.title", values),
  };
};
