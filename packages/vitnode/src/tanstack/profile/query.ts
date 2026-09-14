import {
  fetchUserProfile,
  userProfileQueryOptions,
} from "@/views/profile/profile-query";

/** One public profile, for the screen, its loader and its breadcrumb. */
export const userProfileQuery = (nameCode: string) =>
  userProfileQueryOptions({ fetchProfile: fetchUserProfile, nameCode });
