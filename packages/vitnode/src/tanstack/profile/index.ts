export { ProfileNotFound } from "./not-found";
export { userProfileQuery } from "./query";
export type { ProfileLoaderContext, ProfileRouteData } from "./route";
export { loadProfileRoute, PROFILE_NAMESPACES } from "./route";
export type { ProfileRouteProps } from "./screen";
export { ProfileRouteContent } from "./screen";

export {
  removeOwnUserImage,
  uploadOwnUserImage,
  userImagePolicyQueryKey,
  userImagePolicyQueryOptions,
} from "@/views/profile/images/self-images-query";
export type {
  UserImageActions,
  UserImageEditor,
  UserImageKind,
  UserImageLimit,
  UserImagePolicy,
} from "@/views/profile/images/types";
export type { ProfileContentProps } from "@/views/profile/profile-content";
export { ProfileContent } from "@/views/profile/profile-content";
export type {
  ProfileRole,
  UserProfile,
  UserProfileFetcher,
} from "@/views/profile/profile-query";
export {
  fetchUserProfile,
  isProfileNotFound,
  normalizeProfileNameCode,
  PROFILE_QUERY_ROOT,
  ProfileRequestError,
  userProfileQueryKey,
  userProfileQueryOptions,
} from "@/views/profile/profile-query";
